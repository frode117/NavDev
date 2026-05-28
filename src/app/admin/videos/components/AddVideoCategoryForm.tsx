'use client'

import { CategoryForm, type CategoryFormValues } from '@/components/shared/category-form'

interface AddVideoCategoryFormProps {
    onSubmit: (values: CategoryFormValues) => void
    defaultValues?: CategoryFormValues
    onCancel?: () => void
}

export function AddVideoCategoryForm({
    onSubmit,
    defaultValues,
    onCancel
}: AddVideoCategoryFormProps) {
    return (
        <CategoryForm
            onSubmit={onSubmit}
            defaultValues={defaultValues || {
                title: "",
                icon: "PlayCircle",
                description: "",
                enabled: true
            }}
            onCancel={onCancel}
            labels={{
                title: "标题",
                titlePlaceholder: "输入分类标题",
                itemName: "分类"
            }}
        />
    )
}
