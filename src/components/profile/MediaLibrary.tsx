"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload, Video, Plus, Folder } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function MediaLibrary({ kind, userId, initialItems, initialAlbums = [] }: { kind: "photo" | "video"; userId: string; initialItems: any[]; initialAlbums?: any[] }) {
  const [items, setItems] = useState(initialItems);
  const [albums, setAlbums] = useState(initialAlbums);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const table = kind === "photo" ? "profile_photos" : "profile_videos";
  const bucket = kind === "photo" ? "profile-photos" : "profile-videos";

  // Album states
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("main");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [newAlbumPrivate, setNewAlbumPrivate] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Filter for viewing
  const [viewAlbumId, setViewAlbumId] = useState<string>("main");

  async function createAlbum() {
    if (!newAlbumName.trim()) return;
    setCreatingAlbum(true);
    setError("");
    const payload: Record<string, unknown> = {
      user_id: userId,
      name: newAlbumName.trim(),
    };
    if (kind === "photo") payload.is_private = newAlbumPrivate;

    const { data: row, error: rowError } = await (supabase as any)
      .from("profile_albums")
      .insert(payload)
      .select()
      .single();

    if (row) {
      setAlbums([row, ...albums]);
      setSelectedAlbumId(row.id);
      setViewAlbumId(row.id);
      setNewAlbumName("");
      setNewAlbumPrivate(false);
    } else {
      setError(rowError?.message ?? "Не удалось создать альбом");
    }
    setCreatingAlbum(false);
  }

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    // Soft rate limit: max 20 uploads / 10 min (RPC no-ops until SQL patch applied)
    const { data: rlOk, error: rlErr } = await supabase.rpc(
      "check_rate_limit" as never,
      {
        p_bucket: "upload",
        p_max: 20,
        p_window_seconds: 600,
      } as never
    );
    if (!rlErr && rlOk === false) {
      setError("Слишком много загрузок. Подождите немного.");
      return;
    }

    const limit = kind === "photo" ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > limit) {
      setError(`Файл больше ${kind === "photo" ? "10" : "100"} МБ`);
      return;
    }
    setLoading(true);
    const ext =
      file.name.split(".").pop()?.toLowerCase() ||
      (kind === "photo" ? "jpg" : "mp4");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const album =
      selectedAlbumId === "main"
        ? null
        : albums.find((a: any) => a.id === selectedAlbumId);
    const isPrivate = !!(kind === "photo" && album?.is_private);
    const uploadBucket = isPrivate ? "profile-photos-private" : bucket;

    const { error: uploadError } = await supabase.storage
      .from(uploadBucket)
      .upload(path, file);
    if (!uploadError) {
      let publicUrl = "";
      if (isPrivate) {
        const { data: signed } = await supabase.storage
          .from(uploadBucket)
          .createSignedUrl(path, 3600);
        publicUrl = signed?.signedUrl ?? "";
        // Store placeholder public path marker; display uses signed URLs
        publicUrl =
          publicUrl ||
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${uploadBucket}/${path}`;
      } else {
        const { data } = supabase.storage.from(uploadBucket).getPublicUrl(path);
        publicUrl = data.publicUrl;
      }

      const { data: row, error: rowError } = await (supabase as any)
        .from(table)
        .insert({
          user_id: userId,
          url: publicUrl,
          storage_path: path,
          album_id: selectedAlbumId === "main" ? null : selectedAlbumId,
        })
        .select()
        .single();
      if (row) {
        setItems((x) => [row, ...x]);
        if (isPrivate && publicUrl) {
          setSignedUrls((s) => ({ ...s, [row.id]: publicUrl }));
        }
      } else {
        await supabase.storage.from(uploadBucket).remove([path]);
        setError(rowError?.message ?? "Не удалось сохранить файл");
      }
    } else {
      setError(
        uploadError.message.includes("Bucket not found")
          ? "Создайте bucket profile-photos-private (SQL-патч) или снимите «приватный»."
          : uploadError.message
      );
    }
    setLoading(false);
    if (input.current) input.current.value = "";
  }

  async function remove(item: any) {
    const album = albums.find((a: any) => a.id === item.album_id);
    const b = album?.is_private ? "profile-photos-private" : bucket;
    await supabase.storage.from(b).remove([item.storage_path]);
    await (supabase as any).from(table).delete().eq("id", item.id);
    setItems((x) => x.filter((v) => v.id !== item.id));
  }

  // filter items based on viewAlbumId
  const displayedItems =
    viewAlbumId === "main"
      ? items.filter((i: any) => !i.album_id)
      : items.filter((i: any) => i.album_id === viewAlbumId);

  // Resolve signed URLs for private album photos when viewing
  useEffect(() => {
    if (kind !== "photo" || viewAlbumId === "main") return;
    const album = albums.find((a: any) => a.id === viewAlbumId);
    if (!album?.is_private) return;
    const privateItems = items.filter((i: any) => i.album_id === viewAlbumId);
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of privateItems) {
        const { data } = await supabase.storage
          .from("profile-photos-private")
          .createSignedUrl(item.storage_path, 3600);
        if (data?.signedUrl) next[item.id] = data.signedUrl;
      }
      if (!cancelled) setSignedUrls((s) => ({ ...s, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, viewAlbumId, albums, items, supabase]);

  return (
    <div className="space-y-6">
      <input 
        ref={input} 
        className="hidden" 
        type="file" 
        accept={kind === "photo" ? "image/*" : "video/mp4,video/webm,video/quicktime"} 
        onChange={(e) => upload(e.target.files?.[0])}
      />
      
      {/* Upload controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start p-4 rounded-2xl border border-gold/10 bg-base-800">
        <div className="flex-1 space-y-3">
          <p className="text-sm font-semibold text-warm-100">Загрузить {kind === "photo" ? "фото" : "видео"}</p>
          
          {kind === "photo" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-400">Куда:</span>
              <select 
                value={selectedAlbumId}
                onChange={(e) => setSelectedAlbumId(e.target.value)}
                className="h-9 w-full sm:w-auto rounded-lg border border-gold/20 bg-base-900 px-3 py-1 text-sm text-slate-200 outline-none focus:border-gold/50"
              >
                <option value="main">Основная страница</option>
                {albums.map(a => (
                  <option key={a.id} value={a.id}>Альбом: {a.name}</option>
                ))}
                <option value="new">+ Создать новый альбом...</option>
              </select>
            </div>
          )}
          
          {selectedAlbumId === "new" && kind === "photo" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Название альбома"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gold/20 bg-base-900 px-3 text-sm text-slate-200 outline-none focus:border-gold/50 placeholder:text-slate-500"
                />
                <Button
                  size="sm"
                  onClick={createAlbum}
                  disabled={!newAlbumName.trim() || creatingAlbum}
                >
                  {creatingAlbum ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Создать
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={newAlbumPrivate}
                  onChange={(e) => setNewAlbumPrivate(e.target.checked)}
                  className="rounded border-gold/30 accent-amber-600"
                />
                Приватный альбом (signed URL, bucket profile-photos-private)
              </label>
            </div>
          )}
        </div>
        
        <Button 
          className="w-full sm:w-auto mt-2 sm:mt-0" 
          onClick={() => input.current?.click()} 
          disabled={loading || (selectedAlbumId === "new")}
        >
          {loading ? <Loader2 className="animate-spin" size={17}/> : kind === "photo" ? <ImagePlus size={17}/> : <Upload size={17}/>}
          Выбрать файл
        </Button>
      </div>

      {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

      {/* Viewing controls */}
      {kind === "photo" && (
        <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
          <button 
            onClick={() => setViewAlbumId("main")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${viewAlbumId === "main" ? "bg-gold text-base-900" : "bg-base-800 text-slate-400 hover:text-slate-200 border border-gold/10"}`}
          >
            Основная страница
          </button>
          {albums.map(a => (
            <button 
              key={a.id}
              onClick={() => setViewAlbumId(a.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${viewAlbumId === a.id ? "bg-gold text-base-900" : "bg-base-800 text-slate-400 hover:text-slate-200 border border-gold/10"}`}
            >
              <Folder size={14} className={viewAlbumId === a.id ? "opacity-70" : "opacity-50"} />
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {displayedItems.map((item) => (
          <div key={item.id} className={`group relative overflow-hidden rounded-2xl border border-gold/10 bg-base-800 ${kind === "photo" ? "aspect-[4/5]" : "aspect-video"}`}>
            {kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrls[item.id] || item.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                src={signedUrls[item.id] || item.url}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            )}
            {kind === "photo" && item.album_id && (
              <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md truncate">
                <Folder size={10} className="inline mr-1 opacity-70" />
                {albums.find(a => a.id === item.album_id)?.name || "Альбом"}
              </div>
            )}
            <button onClick={() => remove(item)} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-label="Удалить">
              <Trash2 size={16}/>
            </button>
          </div>
        ))}
        {!displayedItems.length && (
          <div className="col-span-full grid min-h-48 place-items-center rounded-2xl border border-dashed border-gold/15 text-slate-500">
            <div className="text-center">
              {kind === "video" ? <Video className="mx-auto mb-2 opacity-50" size={32} /> : <ImagePlus className="mx-auto mb-2 opacity-50" size={32} />}
              Здесь пока ничего нет
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
