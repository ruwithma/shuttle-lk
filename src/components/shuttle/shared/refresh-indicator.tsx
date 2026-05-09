'use client'

import { motion } from 'framer-motion'

export default function RefreshIndicator({ loading }: { loading: boolean }) {
  if (!loading) return null

  return (
    <div className="sticky top-0 z-30 h-1 w-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}
