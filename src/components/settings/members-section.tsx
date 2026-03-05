"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Users,
  UserPlus,
  Crown,
  ShieldCheck,
  Pencil,
  Eye,
  X,
  Clock,
  Send,
  Copy,
  Link2,
} from "lucide-react"
import { toast } from "sonner"
import { useOrg, forceRefreshOrg } from "@/hooks/use-org"

interface Member {
  id: string
  fullName: string | null
  email: string
  role: string
  createdAt: string
}

interface Invite {
  id: string
  invited_email: string
  role: string
  invite_status: string
  created_at: string
  expires_at: string
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <ShieldCheck className="h-3 w-3" />,
  editor: <Pencil className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
}

export default function MembersSection() {
  const { orgId } = useOrg()
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [currentRole, setCurrentRole] = useState("")
  const [loading, setLoading] = useState(true)

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("viewer")
  const [sending, setSending] = useState(false)

  // Join org form
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)

  const canManage = currentRole === "owner" || currentRole === "admin"
  const orgCode = orgId ? orgId.slice(0, 8) : ""

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/org/members")
      if (!res.ok) return
      const data = await res.json()
      setMembers(data.members)
      setInvites(data.invites)
      setCurrentUserId(data.currentUserId)
      setCurrentRole(data.currentRole)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  function handleCopyCode() {
    if (!orgCode) return
    navigator.clipboard.writeText(orgCode)
    toast.success("Codigo copiado!")
  }

  async function handleJoinOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)

    try {
      const res = await fetch("/api/org/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgCode: joinCode.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao entrar na org")
        return
      }

      toast.success(`Entrou na organizacao: ${data.orgName}`)
      setJoinCode("")
      forceRefreshOrg()
      // Reload page to refresh all data with new org
      setTimeout(() => window.location.reload(), 500)
    } catch {
      toast.error("Erro ao entrar na org")
    } finally {
      setJoining(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)

    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao enviar convite")
        return
      }

      toast.success(`Convite enviado para ${inviteEmail}`)
      setInviteEmail("")
      setShowInviteForm(false)
      loadMembers()
    } catch {
      toast.error("Erro ao enviar convite")
    } finally {
      setSending(false)
    }
  }

  async function handleRemoveMember(id: string) {
    if (!confirm("Tem certeza que deseja remover este membro?")) return

    try {
      const res = await fetch(`/api/org/members/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "member" }),
      })
      if (res.ok) {
        toast.success("Membro removido")
        loadMembers()
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Erro ao remover")
      }
    } catch {
      toast.error("Erro ao remover membro")
    }
  }

  async function handleRevokeInvite(id: string) {
    try {
      const res = await fetch(`/api/org/members/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invite" }),
      })
      if (res.ok) {
        toast.success("Convite revogado")
        loadMembers()
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Erro ao revogar")
      }
    } catch {
      toast.error("Erro ao revogar convite")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Membros</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Membros</CardTitle>
              <CardDescription>{members.length} membro{members.length !== 1 ? "s" : ""}</CardDescription>
            </div>
          </div>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInviteForm(!showInviteForm)}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Convidar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Org code — share with partner */}
        {orgCode && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-dashed border-muted">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Codigo da Org</p>
              <p className="text-sm font-mono font-semibold tracking-wider">{orgCode}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleCopyCode}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </Button>
          </div>
        )}

        {/* Join org form */}
        <form onSubmit={handleJoinOrg} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Entrar em outra organizacao</label>
            <Input
              type="text"
              placeholder="Cole o codigo da org"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
          <Button type="submit" size="sm" className="h-8" disabled={joining || !joinCode.trim()}>
            <Link2 className="h-3 w-3 mr-1" />
            {joining ? "..." : "Entrar"}
          </Button>
        </form>

        {/* Invite form */}
        {showInviteForm && (
          <form onSubmit={handleInvite} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Papel</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" size="sm" className="h-8" disabled={sending}>
              <Send className="h-3 w-3 mr-1" />
              {sending ? "..." : "Enviar"}
            </Button>
          </form>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.fullName ?? member.email}
                    {member.id === currentUserId && (
                      <span className="text-xs text-muted-foreground ml-1">(voce)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] gap-1",
                    member.role === "owner" && "bg-amber-500/20 text-amber-400",
                    member.role === "admin" && "bg-blue-500/20 text-blue-400",
                    member.role === "editor" && "bg-purple-500/20 text-purple-400",
                    member.role === "viewer" && "bg-muted text-muted-foreground"
                  )}
                >
                  {ROLE_ICONS[member.role]}
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>
                {canManage && member.id !== currentUserId && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                Convites pendentes ({invites.length})
              </span>
            </div>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/20 border border-dashed border-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">
                      {invite.invited_email}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Expira em {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground gap-1">
                      {ROLE_ICONS[invite.role]}
                      {ROLE_LABELS[invite.role] ?? invite.role}
                    </Badge>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevokeInvite(invite.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
