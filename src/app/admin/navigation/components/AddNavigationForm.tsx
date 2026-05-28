'use client'

import { CategoryForm, type CategoryFormValues } from '@/components/shared/category-form'

interface AddNavigationFormProps {
    onSubmit: (values: CategoryFormValues) => void
    defaultValues?: CategoryFormValues
    onCancel?: () => void
}

export function AddNavigationForm({
    onSubmit,
    defaultValues,
    onCancel
}: AddNavigationFormProps) {
    return (
        <CategoryForm
            onSubmit={onSubmit}
            defaultValues={defaultValues || {
                title: "",
                icon: "FolderKanban",
                description: "",
                enabled: true
            }}
            onCancel={onCancel}
            labels={{
                title: "标题",
                titlePlaceholder: "输入导航标题",
                itemName: "导航项"
            }}
        />
    )
}
