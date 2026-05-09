'use client'

import { type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: {
    value: number
    positive: boolean
  }
  className?: string
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-emerald-600 dark:text-emerald-400',
  iconBg = 'bg-emerald-50 dark:bg-emerald-900/50',
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('rounded-2xl border-0 shadow-sm dark:bg-gray-900', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                )}
              >
                {trend.positive ? '+' : ''}{trend.value}%
              </p>
            )}
          </div>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
