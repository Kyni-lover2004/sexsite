"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Heart,
  Headphones,
  MessageCircle,
  MessageSquare,
  UserPlus,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

function iconFor(type: string) {
  switch (type) {
    case "friend_request":
    case "friend_accepted":
      return <UserPlus size={14} className="text-gold-soft" />;
    case "guest":
      return <Eye size={14} className="text-gold-soft" />;
    case "chat_message":
      return <MessageCircle size={14} className="text-gold-soft" />;
    case "support_reply":
      return <Headphones size={14} className="text-gold-soft" />;
    case "topic_comment":
      return <MessageSquare size={14} className="text-gold-soft" />;
    case "profile_like":
      return <Heart size={14} className="text-rose-300" />;
    default:
      return <Bell size={14} className="text-gold-soft" />;
  }
}

/**
 * Bell + panel: unread count, recent notifications, mark read.
 * Panel is portaled (fixed) so it never clips under the header or
 * stretches the page layout downward.
 */
export function NotificationBell({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshCount = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      setUnread(0);
      return;
    }
    const { data, error } = await (supabase as any).rpc(
      "count_unread_notifications"
    );
    if (error) {
      setUnread(0);
      return;
    }
    setUnread(typeof data === "number" ? data : 0);
  }, [supabase]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("notifications")
      .select(
        `id, user_id, type, title, body, link, actor_id, meta, read_at, created_at,
         actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)`
      )
      .eq("user_id", session.session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(
      (data ?? []).map((row: any) => ({
        ...row,
        actor: Array.isArray(row.actor) ? row.actor[0] ?? null : row.actor,
      }))
    );
    setLoading(false);
  }, [supabase]);

  const placePanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const gap = 8;
    const maxH = Math.min(window.innerHeight * 0.62, 420);

    if (isMobile) {
      // Full-width card under the top bar — never "grows" the page
      const top = Math.max(
        r.bottom + gap,
        // clear fixed header + safe area
        56 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-top)") || "0", 10) || 0)
      );
      setPanelStyle({
        position: "fixed",
        top: Math.min(top, window.innerHeight * 0.2),
        left: 12,
        right: 12,
        width: "auto",
        maxHeight: maxH,
        zIndex: 80,
      });
      return;
    }

    // Desktop: anchor under the bell, flip up if not enough space below
    const width = 352;
    let left = r.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove - 4 : spaceBelow - 4);

    setPanelStyle({
      position: "fixed",
      top: openUp ? undefined : r.bottom + gap,
      bottom: openUp ? window.innerHeight - r.top + gap : undefined,
      left,
      width,
      maxHeight: height,
      zIndex: 80,
    });
  }, []);

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => void refreshCount(), 45_000);
    const onFocus = () => void refreshCount();
    window.addEventListener("focus", onFocus);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            void refreshCount();
            if (open) void loadList();
          }
        )
        .subscribe();
    })();

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, refreshCount, loadList, open]);

  useEffect(() => {
    if (!open) return;
    placePanel();
    void loadList();

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      placePanel();
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, loadList, placePanel]);

  async function markAllRead() {
    await (supabase as any).rpc("mark_notifications_read");
    setUnread(0);
    setItems((prev) =>
      prev.map((n) => ({
        ...n,
        read_at: n.read_at ?? new Date().toISOString(),
      }))
    );
  }

  async function openItem(n: AppNotification) {
    if (!n.read_at) {
      await (supabase as any).rpc("mark_notifications_read", {
        p_ids: [n.id],
      });
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
        )
      );
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  const panel =
    open && mounted
      ? createPortal(
          <>
            {/* dim backdrop on mobile so it feels like a sheet, not page growth */}
            <button
              type="button"
              aria-label="Закрыть"
              className="fixed inset-0 z-[70] bg-black/45 md:bg-transparent"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              style={panelStyle}
              className="flex flex-col overflow-hidden rounded-2xl border border-gold/15 bg-base-950 shadow-2xl"
              role="dialog"
              aria-label="Уведомления"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-gold/10 px-3 py-2.5">
                <p className="text-sm font-semibold text-warm-100">
                  Уведомления
                </p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="inline-flex items-center gap-1 text-[11px] text-gold-soft hover:underline"
                    >
                      <CheckCheck size={12} />
                      Прочитать все
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-base-800 hover:text-warm-100 md:hidden"
                    aria-label="Закрыть"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-gold-soft" />
                  </div>
                ) : items.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">
                    Пока тихо — сюда придут заявки, гости, сообщения и ответы
                  </p>
                ) : (
                  items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => void openItem(n)}
                      className={cn(
                        "flex w-full gap-2.5 border-b border-gold/5 px-3 py-2.5 text-left transition-colors hover:bg-gold/[0.06]",
                        !n.read_at && "bg-gold/[0.04]"
                      )}
                    >
                      {n.actor ? (
                        <Avatar
                          src={n.actor.avatar_url}
                          name={n.actor.display_name ?? n.actor.username}
                          size="sm"
                        />
                      ) : (
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/15 bg-base-900">
                          {iconFor(n.type)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-warm-100">
                          {iconFor(n.type)}
                          <span className="truncate">{n.title}</span>
                          {!n.read_at && (
                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-gold-soft" />
                          )}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                          {n.body}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-gold/10 px-3 py-2">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block text-center text-xs font-medium text-gold-soft hover:underline"
                >
                  Все уведомления
                </Link>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid place-items-center rounded-xl border border-gold/20 bg-base-900/70 text-warm-100 transition-colors hover:border-gold/35 hover:bg-gold/10",
          compact ? "h-10 w-10" : "h-9 w-9"
        )}
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Уведомления, ${unread} непрочитанных` : "Уведомления"
        }
      >
        <Bell size={compact ? 18 : 16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-gradient px-1 text-[9px] font-bold text-white shadow-neon-gold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
