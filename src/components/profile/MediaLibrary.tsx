"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function MediaLibrary({ kind, userId, initialItems }: { kind: "photo" | "video"; userId: string; initialItems: any[] }) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const table = kind === "photo" ? "profile_photos" : "profile_videos";
  const bucket = kind === "photo" ? "profile-photos" : "profile-videos";
  async function upload(file?: File) { if (!file) return; setError(""); const limit = kind === "photo" ? 10 * 1024 * 1024 : 100 * 1024 * 1024; if (file.size > limit) { setError(`Файл больше ${kind === "photo" ? "10" : "100"} МБ`); return; } setLoading(true); const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "photo" ? "jpg" : "mp4"); const path = `${userId}/${crypto.randomUUID()}.${ext}`; const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file); if (!uploadError) { const { data } = supabase.storage.from(bucket).getPublicUrl(path); const { data: row, error: rowError } = await (supabase as any).from(table).insert({ user_id: userId, url: data.publicUrl, storage_path: path }).select().single(); if (row) setItems((x) => [row, ...x]); else { await supabase.storage.from(bucket).remove([path]); setError(rowError?.message ?? "Не удалось сохранить файл"); } } else setError(uploadError.message); setLoading(false); if (input.current) input.current.value = ""; }
  async function remove(item: any) { await supabase.storage.from(bucket).remove([item.storage_path]); await (supabase as any).from(table).delete().eq("id", item.id); setItems((x) => x.filter((v) => v.id !== item.id)); }
  return <div className="space-y-5"><input ref={input} className="hidden" type="file" accept={kind === "photo" ? "image/*" : "video/mp4,video/webm,video/quicktime"} onChange={(e) => upload(e.target.files?.[0])}/><Button className="w-full min-[420px]:w-auto" onClick={() => input.current?.click()} disabled={loading}>{loading ? <Loader2 className="animate-spin" size={17}/> : kind === "photo" ? <ImagePlus size={17}/> : <Upload size={17}/>}Загрузить {kind === "photo" ? "фото" : "видео"}</Button>{error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}<div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">{items.map((item) => <div key={item.id} className={`group relative overflow-hidden rounded-2xl border border-gold/10 bg-base-800 ${kind === "photo" ? "aspect-[4/5]" : "aspect-video"}`}>{kind === "photo" ? <img src={item.url} alt="" className="h-full w-full object-cover"/> : <video src={item.url} controls playsInline className="h-full w-full object-contain"/>}<button onClick={() => remove(item)} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white" aria-label="Удалить"><Trash2 size={16}/></button></div>)}{!items.length && <div className="col-span-full grid min-h-48 place-items-center rounded-2xl border border-dashed border-gold/15 text-slate-500"><div className="text-center">{kind === "video" && <Video className="mx-auto mb-2"/>}Медиатека пока пуста</div></div>}</div></div>;
}
