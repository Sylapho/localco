import AuthForm from '@/components/auth/auth-form'

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <AuthForm mode="sign-up" />
    </main>
  )
}
