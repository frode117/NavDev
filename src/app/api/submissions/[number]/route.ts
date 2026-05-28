import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SUBMISSION_LABELS, parseSubmissionFromIssueBody } from '@/types/submission'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

const GITHUB_API = 'https://api.github.com'
const GITHUB_OWNER = process.env.GITHUB_OWNER!
const GITHUB_REPO = process.env.GITHUB_REPO!
const GITHUB_PAT = process.env.GITHUB_PAT!

interface RouteParams {
  params: Promise<{ number: string }>
}

async function getNavigationData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
  return data || { navigationItems: [] }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: '请先登录' },
        { status: 401 }
      )
    }

    const { number } = await params
    const issueNumber = number
    const { action, reason } = await request.json()

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: '无效的操作' },
        { status: 400 }
      )
    }

    const issueResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )

    if (!issueResponse.ok) {
      return NextResponse.json(
        { success: false, message: 'Issue 不存在' },
        { status: 404 }
      )
    }

    const issue = await issueResponse.json()
    const submissionData = parseSubmissionFromIssueBody(issue.body)

    if (!submissionData) {
      return NextResponse.json(
        { success: false, message: '无法解析投稿数据' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      const navigationData = await getNavigationData()

      if (!navigationData || !navigationData.navigationItems) {
        return NextResponse.json(
          { success: false, message: '无法读取导航数据' },
          { status: 500 }
        )
      }

      const categoryId = submissionData.category
      const subcategoryId = submissionData.subcategory

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let targetCategory: any = navigationData.navigationItems.find(
        (item) => item.id === categoryId || item.title === categoryId
      )

      if (!targetCategory) {
        targetCategory = navigationData.navigationItems[0]
      }

      const newItem = {
        id: `${Date.now()}`,
        title: submissionData.title,
        href: submissionData.url,
        description: submissionData.description,
        icon: '/assets/images/default-website-icon.png',
        enabled: true
      }

      if (subcategoryId && targetCategory.subCategories) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetSubCategory = targetCategory.subCategories.find(
          (sub: any) => sub.id === subcategoryId || sub.title === subcategoryId
        )
        if (targetSubCategory) {
          if (!targetSubCategory.items) {
            targetSubCategory.items = []
          }
          targetSubCategory.items.push(newItem)
        } else {
          if (!targetCategory.items) {
            targetCategory.items = []
          }
          targetCategory.items.push(newItem)
        }
      } else {
        if (!targetCategory.items) {
          targetCategory.items = []
        }
        targetCategory.items.push(newItem)
      }

      try {
        await kvSet(KV_KEYS.NAVIGATION, navigationData)
      } catch (saveError) {
        console.error('KV save error:', saveError)
        const errMsg = saveError instanceof Error ? saveError.message : String(saveError)
        return NextResponse.json(
          { success: false, message: `更新导航数据失败: ${errMsg}` },
          { status: 500 }
        )
      }

      await updateIssueLabels(issueNumber, SUBMISSION_LABELS.APPROVED, SUBMISSION_LABELS.PENDING)

      await addIssueComment(
        issueNumber,
        `✅ **投稿已通过**\n\n该网站已成功添加到导航列表。\n\n审核人: @${session.user.name || 'admin'}`
      )

      await closeIssue(issueNumber)

      return NextResponse.json({
        success: true,
        message: '投稿已通过，网站已添加到导航列表'
      })

    } else {
      await updateIssueLabels(issueNumber, SUBMISSION_LABELS.REJECTED, SUBMISSION_LABELS.PENDING)

      await addIssueComment(
        issueNumber,
        `❌ **投稿已拒绝**\n\n${reason ? `拒绝原因: ${reason}` : '感谢您的投稿，但该网站暂不符合我们的收录标准。'}\n\n审核人: @${session.user.name || 'admin'}`
      )

      await closeIssue(issueNumber)

      return NextResponse.json({
        success: true,
        message: '投稿已拒绝'
      })
    }

  } catch (error) {
    console.error('Review submission error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, message: `审核失败: ${errorMsg}` },
      { status: 500 }
    )
  }
}

async function updateIssueLabels(issueNumber: string, addLabel: string, removeLabel: string) {
  const issueResponse = await fetch(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
    {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  const issue = await issueResponse.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentLabels = issue.labels.map((l: any) => l.name)

  const newLabels = currentLabels
    .filter((l: string) => l !== removeLabel)
    .concat(addLabel)

  await fetch(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ labels: newLabels })
    }
  )
}

async function addIssueComment(issueNumber: string, body: string) {
  await fetch(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ body })
    }
  )
}

async function closeIssue(issueNumber: string) {
  await fetch(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ state: 'closed' })
    }
  )
}
