"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Pencil,
  MapPin,
  Calendar,
  Save,
  X,
  MessageCircle,
  Camera,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Badge";
import { ageFromBirthDate, isOnline, timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface ProfileViewProps {
  profile: Profile;
  isOwn: boolean;
}

export function ProfileView({ profile, isOwn }: ProfileViewProps) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    display_name: profile.display_name ?? "",
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    interests: profile.interests.join(", "),
  });

  const online = isOnline(profile.last_seen);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);

    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${profile.id}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await (supabase as any).storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = await (supabase as any).storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = urlData?.publicUrl ?? null;

      await (supabase as any)
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      router.refresh();
    } catch (err) {
      console.error("Avatar upload error:", err);
    }

    setUploadingAvatar(false);
  }

  async function handleSave() {
    const supa = supabase as any;
    setSaving(true);
    const interests = form.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await supa
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        bio: form.bio || null,
        city: form.city || null,
        interests,
      })
      .eq("id", profile.id);

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const age = ageFromBirthDate(profile.birth_date);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard premium className="relative overflow-hidden p-6">
          {/* Gradient banner behind avatar */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-accent/20 via-accent-deep/10 to-gold/10" />
          <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

          <div className="relative flex items-start gap-4 pt-6">
            <div className="relative group">
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name ?? profile.username}
                size="xl"
                lastSeen={profile.last_seen}
                showPresence
              />
              {/* Glow behind avatar */}
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-accent/20 blur-xl" />

              {/* Avatar upload overlay (only when own profile) */}
              {isOwn && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                  >
                    {uploadingAvatar ? (
                      <Loader2 size={20} className="animate-spin text-white" />
                    ) : (
                      <Camera size={20} className="text-white" />
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3">
                  <Input
                    value={form.display_name}
                    onChange={(e) =>
                      setForm({ ...form, display_name: e.target.value })
                    }
                    placeholder="Имя"
                  />
                  <Textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="О себе"
                    rows={3}
                  />
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Город"
                  />
                  <Input
                    value={form.interests}
                    onChange={(e) =>
                      setForm({ ...form, interests: e.target.value })
                    }
                    placeholder="Интересы (через запятую)"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <Save size={14} />
                      {saving ? "…" : "Сохранить"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      <X size={14} />
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="font-display text-xl font-bold text-gradient">
                        {profile.display_name ?? profile.username}
                      </h1>
                      <p className="text-sm text-slate-500">
                        @{profile.username}
                      </p>
                    </div>
                    {isOwn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil size={16} />
                      </Button>
                    )}
                  </div>

                  {profile.status && (
                    <p className="mt-2 text-sm text-accent-soft">
                      {profile.status}
                    </p>
                  )}

                  {profile.bio && (
                    <p className="mt-2 text-sm text-slate-400">{profile.bio}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {profile.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {profile.city}
                      </span>
                    )}
                    {age && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {age} лет
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          online ? "bg-emerald-glow shadow-glow-emerald" : "bg-slate-600"
                        }`}
                      />
                      {online ? "В сети" : `Был(а) ${timeAgo(profile.last_seen)}`}
                    </span>
                  </div>

                  {profile.interests.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {profile.interests.map((tag) => (
                        <Tag key={tag} label={tag} />
                      ))}
                    </div>
                  )}

                  {!isOwn && (
                    <div className="mt-4">
                      <Link href={`/chat/${profile.id}`}>
                        <Button size="sm">
                          <MessageCircle size={14} />
                          Написать сообщение
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
