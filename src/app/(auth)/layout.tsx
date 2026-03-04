import Image from "next/image"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-md space-y-6 p-6">
        <div className="flex flex-col items-center space-y-3">
          <Image
            src="/logo.png"
            alt="ASSUMFIT"
            width={200}
            height={55}
            className="h-12 w-auto"
            priority
          />
          <p className="text-sm text-muted-foreground">
            Financial Command Center
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
