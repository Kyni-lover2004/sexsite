"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface WallPost {
  id: string;
  body: string;
  created_at: string;
}

export function ProfileWall({
  profileId,
  isOwn,
}: {
  profileId: string;
  isOwn: boolean;
}) {
  const supabase = createClient();
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadPosts = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("profile_wall_posts")
      .select("id, body, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false });
    setPosts((data as WallPost[]) ?? []);
    setLoading(false);
  }, [profileId, supabase]);

  useEffect(() => {
    setLoading(true);
    void loadPosts();
  }, [loadPosts]);

  async function publish() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data } = await (supabase as any)
        .from("profile_wall_posts")
        .insert({
          user_id: profileId,
          author_id: auth.user.id,
          body: text,
        })
        .select("id, body, created_at")
        .single();

      if (data) {
        setPosts((prev) => [data as WallPost, ...prev]);
        setBody("");
      }
    }

    setSending(false);
  }

  async function remove(id: string) {
    const { error } = await (supabase as any)
      .from("profile_wall_posts")
      .delete()
      .eq("id", id);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  return (
    <section className="rounded-2xl border border-gold/10 bg-base-800/45 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-warm-100">Стена</h2>

      {isOwn && (
        <div className="mt-4 space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Поделитесь новостью…"
            className="w-full resize-none rounded-xl border border-gold/15 bg-base-900/60 p-3 text-base text-warm-100 outline-none focus:border-gold/45"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{body.length}/2000</span>
            <Button onClick={publish} disabled={!body.trim() || sending}>
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Опубликовать
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <Loader2 className="mx-auto animate-spin text-gold-soft" />
        ) : posts.length ? (
          posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-gold/10 bg-base-900/45 p-4"
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                {post.body}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <time className="text-xs text-slate-500">
                  {new Date(post.created_at).toLocaleString("ru-RU")}
                </time>
                {isOwn && (
                  <button
                    onClick={() => remove(post.id)}
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Удалить запись"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            На стене пока нет записей
          </p>
        )}
      </div>
    </section>
  );
}
