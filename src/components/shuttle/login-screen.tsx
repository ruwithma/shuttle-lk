'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bus, Crown, Gauge, GraduationCap, Phone, Lock, Loader2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import type { UserRole } from '@/lib/types'
import { toast } from '@/hooks/use-toast'

const DEMO_ACCOUNTS = [
  { role: 'OWNER' as UserRole, phone: '0771234567', label: 'Bus Owner' },
  { role: 'DRIVER' as UserRole, phone: '0772345678', label: 'Driver' },
  { role: 'STUDENT' as UserRole, phone: '0712345001', label: 'Student' },
]

export default function LoginScreen() {
  const { setCurrentUser, setIsLoading, isLoading } = useAppStore()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('123456')
  const [selectedRole, setSelectedRole] = useState<UserRole>('OWNER')
  const [seeding, setSeeding] = useState(false)

  const handleLogin = async () => {
    if (!phone.trim()) {
      toast({ title: 'Error', description: 'Please enter your phone number', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, role: selectedRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Login Failed', description: data.error || 'Invalid credentials', variant: 'destructive' })
        return
      }
      setCurrentUser(data.user)
      toast({ title: 'Welcome!', description: `Logged in as ${data.user.name}` })
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Success', description: 'Demo data seeded successfully!' })
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to seed data', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error while seeding', variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  const fillDemo = (account: typeof DEMO_ACCOUNTS[number]) => {
    setPhone(account.phone)
    setSelectedRole(account.role)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm"
      >
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto mb-4 flex items-center justify-center"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Bus className="w-10 h-10 text-white" />
            </motion.div>
          </motion.div>
          <h1 className="text-3xl font-bold text-white">ShuttleLK</h1>
          <p className="text-emerald-100 mt-1 text-sm font-medium">Smart Shuttle Management for Sri Lanka</p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-2xl rounded-2xl">
            <CardContent className="p-6 space-y-5">
              {/* Role Selector */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Select your role</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { role: 'OWNER' as UserRole, icon: Crown, label: 'Owner', color: 'amber' },
                    { role: 'DRIVER' as UserRole, icon: Gauge, label: 'Driver', color: 'emerald' },
                    { role: 'STUDENT' as UserRole, icon: GraduationCap, label: 'Student', color: 'blue' },
                  ].map((item) => (
                    <motion.button
                      key={item.role}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedRole(item.role)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        selectedRole === item.role
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <item.icon className="w-5 h-5 mb-1" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="Phone number (e.g. 0771234567)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Login Button */}
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Login'
                )}
              </Button>

              {/* Seed Button */}
              <Button
                variant="outline"
                onClick={handleSeed}
                disabled={seeding}
                className="w-full h-10 rounded-xl text-sm"
              >
                {seeding ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Seed Demo Data
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Demo Accounts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <p className="text-center text-emerald-100 text-sm mb-3 font-medium">⚡ Quick Login</p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => {
              const roleColors: Record<string, string> = {
                OWNER: 'from-amber-500/40 to-amber-600/30 border-amber-400/40',
                DRIVER: 'from-emerald-500/40 to-emerald-600/30 border-emerald-400/40',
                STUDENT: 'from-teal-500/40 to-teal-600/30 border-teal-400/40',
              }
              const roleIcons: Record<string, React.ReactNode> = {
                OWNER: <Crown className="w-4 h-4 text-amber-200" />,
                DRIVER: <Gauge className="w-4 h-4 text-emerald-200" />,
                STUDENT: <GraduationCap className="w-4 h-4 text-teal-200" />,
              }
              return (
                <motion.button
                  key={account.role}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => fillDemo(account)}
                  className={`w-full bg-gradient-to-r ${roleColors[account.role]} backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 border text-white hover:brightness-110 transition-all`}
                >
                  {roleIcons[account.role]}
                  <span className="text-sm font-semibold flex-1 text-left">{account.label}</span>
                  <span className="text-xs opacity-80">{account.phone}</span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
