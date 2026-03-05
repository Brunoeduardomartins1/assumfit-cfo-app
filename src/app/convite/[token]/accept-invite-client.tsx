"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserPlus, AlertTriangle, CheckCircle2, XCircle, Mail, Loader2 } from "lucide-react"
import { forceRefreshOrg } from "@/hooks/use-org"

type InviteStatus =
  | "needs_auth"
  | "not_found"
  | "expired"
  | "already_used"
  | "revoked"
  | "email_mismatch"
  | "accepted"

interface Props {
  status: InviteStatus
  token: string
  orgName?: string
  role?: string
  invitedEmail?: string
  currentEmail?: string
}

export default function AcceptInviteClient({
  status,
  token,
  orgName,
  role,
  invitedEmail,
  currentEmail,
}: Props) {
  const router = useRouter()

  // When invite is accepted server-side, invalidate org cache and redirect client-side
  useEffect(() => {
    if (status === "accepted") {
      forceRefreshOrg()
      router.push("/painel")
      router.refresh()
    }
  }, [status, router])

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    editor: "Editor",
    viewer: "Visualizador",
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            {status === "accepted" && <Loader2 className="h-10 w-10 text-primary animate-spin" />}
            {status === "needs_auth" && <UserPlus className="h-10 w-10 text-primary" />}
            {status === "not_found" && <XCircle className="h-10 w-10 text-destructive" />}
            {status === "expired" && <AlertTriangle className="h-10 w-10 text-yellow-500" />}
            {status === "already_used" && <CheckCircle2 className="h-10 w-10 text-green-500" />}
            {status === "revoked" && <XCircle className="h-10 w-10 text-destructive" />}
            {status === "email_mismatch" && <Mail className="h-10 w-10 text-yellow-500" />}
          </div>
          <CardTitle className="text-lg">
            {status === "accepted" && "Convite aceito!"}
            {status === "needs_auth" && "Convite para Organizacao"}
            {status === "not_found" && "Convite nao encontrado"}
            {status === "expired" && "Convite expirado"}
            {status === "already_used" && "Convite ja utilizado"}
            {status === "revoked" && "Convite revogado"}
            {status === "email_mismatch" && "Email incorreto"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "accepted" && (
            <p className="text-sm text-muted-foreground">
              Redirecionando para o painel...
            </p>
          )}

          {status === "needs_auth" && (
            <>
              <p className="text-sm text-muted-foreground">
                Voce foi convidado para participar de{" "}
                <span className="font-semibold text-foreground">{orgName}</span> como{" "}
                <span className="font-semibold text-foreground">
                  {roleLabels[role ?? ""] ?? role}
                </span>
                .
              </p>
              {invitedEmail && (
                <p className="text-xs text-muted-foreground">
                  Convite enviado para: <strong>{invitedEmail}</strong>
                </p>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Button asChild>
                  <Link href={`/login?invite=${token}`}>Entrar com conta existente</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/cadastro?invite=${token}`}>Criar nova conta</Link>
                </Button>
              </div>
            </>
          )}

          {status === "not_found" && (
            <>
              <p className="text-sm text-muted-foreground">
                Este link de convite nao existe ou ja foi removido.
              </p>
              <Button variant="outline" asChild>
                <Link href="/login">Ir para Login</Link>
              </Button>
            </>
          )}

          {status === "expired" && (
            <>
              <p className="text-sm text-muted-foreground">
                Este convite expirou. Peca ao administrador para enviar um novo convite.
              </p>
              <Button variant="outline" asChild>
                <Link href="/login">Ir para Login</Link>
              </Button>
            </>
          )}

          {status === "already_used" && (
            <>
              <p className="text-sm text-muted-foreground">
                Este convite ja foi aceito. Voce pode acessar o painel normalmente.
              </p>
              <Button asChild>
                <Link href="/painel">Ir para o Painel</Link>
              </Button>
            </>
          )}

          {status === "revoked" && (
            <>
              <p className="text-sm text-muted-foreground">
                Este convite foi revogado pelo administrador.
              </p>
              <Button variant="outline" asChild>
                <Link href="/login">Ir para Login</Link>
              </Button>
            </>
          )}

          {status === "email_mismatch" && (
            <>
              <p className="text-sm text-muted-foreground">
                Este convite foi enviado para{" "}
                <strong>{invitedEmail}</strong>, mas voce esta logado como{" "}
                <strong>{currentEmail}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Faca logout e entre com o email correto.
              </p>
              <Button variant="outline" asChild>
                <Link href="/login">Trocar de conta</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
