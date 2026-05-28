'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/registry/new-york/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/registry/new-york/ui/dialog"
import { useToast } from "@/registry/new-york/hooks/use-toast"
import { Draggable } from "@hello-pangea/dnd"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/registry/new-york/ui/tooltip"
import { NavigationItem } from '@/types/navigation'
import { navigationIcons, type IconType } from '@/lib/icons'
import {
    FolderOpen,
    Pencil,
    Trash,
    ChevronsUp,
    ChevronsDown
} from 'lucide-react'
import { cn } from "@/lib/utils"
import { Badge } from "@/registry/new-york/ui/badge"
import { CategoryForm, type CategoryFormValues } from '@/components/shared/category-form'

interface ItemCardProps {
    item: NavigationItem
    index: number
    onUpdate: () => void
    onMoveToTop?: () => void
    onMoveToBottom?: () => void
    showMoveToTop?: boolean
    showMoveToBottom?: boolean
    config: {
        apiBasePath: string
        subCategoriesPath: string
        labels: {
            editTitle: string
            deleteTitle: string
            deleteDescription: string
            subCategoryTooltip: string
            itemName: string
        }
    }
}

export function ItemCard({
    item,
    index,
    onUpdate,
    onMoveToTop,
    onMoveToBottom,
    showMoveToTop,
    showMoveToBottom,
    config
}: ItemCardProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

    const Icon = item.icon && navigationIcons[item.icon as IconType]
        ? navigationIcons[item.icon as IconType]
        : navigationIcons.Folder

    const handleDoubleClick = () => {
        router.push(`${config.subCategoriesPath}/${item.id}/categories`)
    }

    const handleEdit = async (values: CategoryFormValues) => {
        try {
            const response = await fetch(`${config.apiBasePath}/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...item,
                    title: values.title,
                    description: values.description,
                    icon: values.icon,
                    enabled: values.enabled
                })
            })

            if (!response.ok) throw new Error('Failed to save')

            setIsEditDialogOpen(false)
            onUpdate()
            toast({
                title: "成功",
                description: "保存成功"
            })
        } catch {
            toast({
                title: "错误",
                description: "保存失败",
                variant: "destructive"
            })
        }
    }

    const handleDelete = async () => {
        try {
            const response = await fetch(`${config.apiBasePath}/${item.id}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Failed to delete')

            setIsDeleteDialogOpen(false)
            onUpdate()
            toast({
                title: "成功",
                description: "删除成功"
            })
        } catch {
            toast({
                title: "错误",
                description: "删除失败",
                variant: "destructive"
            })
        }
    }

    return (
        <Draggable draggableId={item.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onDoubleClick={handleDoubleClick}
                    className={`group flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-colors cursor-pointer ${snapshot.isDragging ? 'bg-gray-50' : ''
                        }`}
                >
                    <div className="flex items-center space-x-4">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium">{item.title}</h3>
                                <Badge
                                    variant={(item.enabled ?? true) ? "default" : "secondary"}
                                    className={cn(
                                        "text-xs",
                                        (item.enabled ?? true)
                                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                                    )}
                                >
                                    {(item.enabled ?? true) ? "已启用" : "已禁用"}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <TooltipProvider>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={onMoveToTop}
                                            className={cn("h-8 w-8", !showMoveToTop && "invisible pointer-events-none")}
                                        >
                                            <ChevronsUp className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>置顶</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={onMoveToBottom}
                                            className={cn("h-8 w-8", !showMoveToBottom && "invisible pointer-events-none")}
                                        >
                                            <ChevronsDown className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>置底</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => router.push(`${config.subCategoriesPath}/${item.id}/categories`)}
                                        className="h-8 w-8"
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{config.labels.subCategoryTooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsEditDialogOpen(true)}
                                        className="h-8 w-8"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>编辑</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsDeleteDialogOpen(true)}
                                        className="h-8 w-8"
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>删除</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{config.labels.editTitle}</DialogTitle>
                            </DialogHeader>
                            <CategoryForm
                                defaultValues={{
                                    title: item.title,
                                    description: item.description || '',
                                    icon: item.icon || '',
                                    enabled: item.enabled ?? true
                                }}
                                onSubmit={handleEdit}
                                onCancel={() => setIsEditDialogOpen(false)}
                                labels={{ itemName: config.labels.itemName }}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{config.labels.deleteTitle}</DialogTitle>
                                <DialogDescription>
                                    {config.labels.deleteDescription}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                    取消
                                </Button>
                                <Button variant="destructive" onClick={handleDelete}>
                                    删除
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </Draggable>
    )
}

export const navigationCardConfig = {
    apiBasePath: '/api/navigation',
    subCategoriesPath: '/admin/navigation',
    labels: {
        editTitle: '编辑分类',
        deleteTitle: '确认删除',
        deleteDescription: '确定要删除这个导航吗？此操作无法撤消，所有相关的分类和子项目都将被删除。',
        subCategoryTooltip: '分类管理',
        itemName: '导航项'
    }
}

export const videoCategoryCardConfig = {
    apiBasePath: '/api/videos',
    subCategoriesPath: '/admin/videos',
    labels: {
        editTitle: '编辑分类',
        deleteTitle: '确认删除',
        deleteDescription: '确定要删除这个分类吗？此操作无法撤消，所有相关的子分类和视频都将被删除。',
        subCategoryTooltip: '子分类管理',
        itemName: '分类'
    }
}
