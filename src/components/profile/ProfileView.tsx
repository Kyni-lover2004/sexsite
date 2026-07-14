"use client";

import { useEffect, useRef, useState } from "react";
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
  MessageSquare,
  CheckCircle2,
  Trash2,
  ImagePlus,
  HeartHandshake,
  Shield,
  Crown,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Badge";
import { ageFromBirthDate, isOnline, timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RUSSIAN_CITIES } from "@/lib/data/russianCities";
import {
  DATING_GOALS,
  INTEREST_SECTIONS,
  getDatingGoalLabel,
} from "@/lib/data/profileOptions";
import type { Profile, ProfilePhoto } from "@/lib/types";

interface ProfileViewProps {
  profile: Profile;
  photos: ProfilePhoto[];
  isOwn: boolean;
}

export function ProfileView({ profile, photos, isOwn }: ProfileViewProps) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [localPhotos, setLocalPhotos] = useState(photos);
  const [available, setAvailable] = useState(profile.available_for_chat);
  const [form, setForm] = useState({
    username: profile.username,
    display_name: profile.display_name ?? "",
    status: profile.status ?? "",
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    birth_date: profile.birth_date ?? "",
    gender: profile.gender ?? "prefer_not_to_say",
    dating_goal: profile.dating_goal ?? "",
    interests: profile.interests.join(", "),
  });

  const online = isOnline(profile.last_seen);

  useEffect(() => {
    setAvailable(profile.available_for_chat);
  }, [profile.available_for_chat]);

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

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

  async function handleProfilePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    setPhotoError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== profile.id) {
      setPhotoError("Нужно войти в свой аккаунт, чтобы добавлять фото.");
      setUploadingPhoto(false);
      return;
    }

    for (const file of files) {
      try {
        if (!file.type.startsWith("image/")) {
          throw new Error("Можно загружать только изображения.");
        }

        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${profile.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await (supabase as any).storage
          .from("profile-photos")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = await (supabase as any).storage
          .from("profile-photos")
          .getPublicUrl(path);

        const { data: insertedPhoto, error: insertError } = await (supabase as any)
          .from("profile_photos")
          .insert({
            user_id: profile.id,
            url: urlData.publicUrl,
            storage_path: path,
            sort_order: localPhotos.length,
          })
          .select("*")
          .single();

        if (insertError) {
          await (supabase as any).storage.from("profile-photos").remove([path]);
          throw insertError;
        }

        setLocalPhotos((prev) => [
          (insertedPhoto ?? {
            id: path,
            user_id: profile.id,
            url: urlData.publicUrl,
            storage_path: path,
            caption: null,
            sort_order: prev.length,
            created_at: new Date().toISOString(),
          }) as ProfilePhoto,
          ...prev,
        ]);
      } catch (err: any) {
        console.error("Profile photo upload error:", err);
        setPhotoError(
          err?.message?.includes("profile_photos") ||
            err?.message?.includes("relation") ||
            err?.message?.includes("bucket")
            ? "В Supabase еще не применена таблица profile_photos или bucket profile-photos. Примените обновленный supabase/schema.sql."
            : `Не удалось добавить фото: ${err?.message ?? "неизвестная ошибка"}`
        );
      }
    }

    if (photoRef.current) photoRef.current.value = "";
    setUploadingPhoto(false);
  }

  async function deleteProfilePhoto(photo: ProfilePhoto) {
    setPhotoError("");
    setLocalPhotos((prev) => prev.filter((item) => item.id !== photo.id));

    const { error: deleteError } = await (supabase as any)
      .from("profile_photos")
      .delete()
      .eq("id", photo.id)
      .eq("user_id", profile.id);

    const { error: storageError } = await (supabase as any).storage
      .from("profile-photos")
      .remove([photo.storage_path]);

    if (deleteError || storageError) {
      console.error("Profile photo delete error:", deleteError ?? storageError);
      setPhotoError("Не удалось удалить фото. Обновите страницу и попробуйте снова.");
      router.refresh();
    }
  }

  async function toggleAvailable() {
    const next = !available;
    setAvailable(next);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ available_for_chat: next })
      .eq("id", profile.id);

    if (error) {
      setAvailable(!next);
      console.error("Available status update error:", error);
      alert(`Ошибка: ${error.message}\nВозможно, в таблице profiles в Supabase отсутствует колонка available_for_chat.`);
    } else {
      router.refresh();
    }
  }

  async function handleSave() {
    const supa = supabase as any;
    setSaving(true);
    setUsernameError("");
    setSaveError("");

    const newUsername = form.username.trim().toLowerCase();
    if (newUsername !== profile.username) {
      const { data: existing } = await supa
        .from("profiles")
        .select("id")
        .eq("username", newUsername)
        .maybeSingle();

      if (existing) {
        setUsernameError("Этот username уже занят");
        setSaving(false);
        return;
      }

      if (newUsername.length < 3) {
        setUsernameError("Минимум 3 символа");
        setSaving(false);
        return;
      }

      if (!/^[a-z0-9_]+$/.test(newUsername)) {
        setUsernameError("Только латиница, цифры и _");
        setSaving(false);
        return;
      }
    }

    const interests = form.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const profileUpdate = {
      username: newUsername,
      display_name: form.display_name || null,
      status: form.status || null,
      bio: form.bio || null,
      city: form.city || null,
      birth_date: form.birth_date || null,
      gender: form.gender,
      dating_goal: form.dating_goal || null,
      interests,
    };

    const { error: updateError } = await supa
      .from("profiles")
      .update(profileUpdate)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Profile save error:", updateError);
      if (updateError.message?.includes("dating_goal")) {
        const { dating_goal: _datingGoal, ...fallbackUpdate } = profileUpdate;
        const { error: fallbackError } = await supa
          .from("profiles")
          .update(fallbackUpdate)
          .eq("id", profile.id);

        if (!fallbackError) {
          setSaveError(
            "Основные поля и интересы сохранены. Поле цели знакомства появится после применения обновленного supabase/schema.sql."
          );
          setSaving(false);
          router.refresh();
          return;
        }
      }

      setSaveError(
        updateError.message?.includes("dating_goal")
          ? "В Supabase еще не применена новая схема профиля. Примените supabase/schema.sql и сохраните профиль снова."
          : `Не удалось сохранить профиль: ${updateError.message}`
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const age = ageFromBirthDate(profile.birth_date);
  const datingGoalLabel = getDatingGoalLabel(profile.dating_goal);
  const selectedInterests = form.interests
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  function toggleInterest(interest: string) {
    const exists = selectedInterests.includes(interest);
    const next = exists
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest];
    setForm({ ...form, interests: next.join(", ") });
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard premium className="relative overflow-hidden p-6">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-gold/20 via-accent-deep/10 to-gold/10" />
          <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

          <div className="relative flex items-start gap-4 pt-6">
            <div className="relative group">
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name ?? profile.username}
                size="xl"
                lastSeen={profile.last_seen}
                showPresence
              />
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gold/20 blur-xl" />

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
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      Username
                    </label>
                    <Input
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      placeholder="username"
                    />
                    {usernameError && (
                      <p className="mt-1 text-xs text-red-400">{usernameError}</p>
                    )}
                  </div>
                  <Input
                    value={form.display_name}
                    onChange={(e) =>
                      setForm({ ...form, display_name: e.target.value })
                    }
                    placeholder="Имя"
                  />
                  <Input
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    placeholder="Статус: что сейчас хочется?"
                  />
                  <Textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="О себе"
                    rows={3}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">
                        Город
                      </label>
                      <Input
                        value={form.city}
                        onChange={(e) =>
                          setForm({ ...form, city: e.target.value })
                        }
                        placeholder="Начните вводить город"
                        list="russian-cities"
                      />
                      <datalist id="russian-cities">
                        {RUSSIAN_CITIES.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">
                        Дата рождения
                      </label>
                      <Input
                        type="date"
                        value={form.birth_date}
                        onChange={(e) =>
                          setForm({ ...form, birth_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      Пол
                    </label>
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm({ ...form, gender: e.target.value as any })
                      }
                      className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                      <option value="prefer_not_to_say">Не указывать</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      Зачем хотите познакомиться
                    </label>
                    <select
                      value={form.dating_goal}
                      onChange={(e) =>
                        setForm({ ...form, dating_goal: e.target.value })
                      }
                      className="h-10 w-full rounded-xl border border-gold/15 bg-base-800/60 px-3.5 text-sm text-slate-100 transition-all duration-300 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                    >
                      <option value="">Не указано</option>
                      {DATING_GOALS.map((goal) => (
                        <option key={goal.value} value={goal.value}>
                          {goal.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-400">
                      Интересы по разделам
                    </label>
                    <div className="space-y-3 rounded-xl border border-gold/10 bg-base-900/40 p-3">
                      {INTEREST_SECTIONS.map((section) => (
                        <div key={section.title}>
                          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-gold-soft/60">
                            {section.title}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {section.items.map((interest) => (
                              <Tag
                                key={interest}
                                label={interest}
                                active={selectedInterests.includes(interest)}
                                onClick={() => toggleInterest(interest)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Input
                      value={form.interests}
                      onChange={(e) =>
                        setForm({ ...form, interests: e.target.value })
                      }
                      placeholder="Свои интересы через запятую"
                      className="mt-3"
                    />
                  </div>
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
                  {saveError && (
                    <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {saveError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                   <div className="flex items-start justify-between">
                    <div>
                      <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-gradient">
                        {profile.display_name ?? profile.username}
                        {profile.role === "admin" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                            <Shield size={10} className="fill-current" />
                            Админ
                          </span>
                        )}
                        {profile.premium_until && new Date(profile.premium_until) > new Date() && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                            <Crown size={10} className="fill-current" />
                            PRO
                          </span>
                        )}
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
                    <p className="mt-2 text-sm text-gold-soft">
                      {profile.status}
                    </p>
                  )}

                  {profile.bio && (
                    <p className="mt-2 text-sm text-slate-400">{profile.bio}</p>
                  )}

                  {datingGoalLabel && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-soft">
                      <HeartHandshake size={14} />
                      {datingGoalLabel}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {profile.gender && profile.gender !== "prefer_not_to_say" && (
                      <span className="flex items-center gap-1">
                        {profile.gender === "male" ? "👨 Мужчина" : "👩 Женщина"}
                      </span>
                    )}
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

                  {(available || isOwn) && (
                    <div className="mt-3">
                      {isOwn ? (
                        <button
                          onClick={toggleAvailable}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-inner-glow transition-all ${
                            available
                              ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:border-emerald-500/40 dark:text-emerald-400"
                              : "border border-gold/25 bg-base-900/65 text-warm-200 hover:border-gold/45 hover:bg-gold/10 hover:text-warm-100"
                          }`}
                        >
                          {available ? (
                            <>
                              <CheckCircle2 size={14} />
                              Готов(а) пообщаться сейчас
                            </>
                          ) : (
                            <>
                              <MessageSquare size={14} />
                              Включить «готов(а) пообщаться»
                            </>
                          )}
                        </button>
                      ) : available ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={14} />
                          Готов(а) пообщаться
                        </span>
                      ) : null}
                    </div>
                  )}

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

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-warm-100">
              Фото профиля
            </h2>
            <p className="text-xs text-slate-500">
              Личные фото, которые видны на странице профиля
            </p>
          </div>
          {isOwn && (
            <>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleProfilePhotoUpload}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => photoRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImagePlus size={14} />
                )}
                Добавить
              </Button>
            </>
          )}
        </div>

        {photoError && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {photoError}
          </p>
        )}

        {localPhotos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gold/15 bg-base-900/30 p-8 text-center">
            <p className="text-sm text-slate-400">
              {isOwn
                ? "Добавьте первое фото, чтобы профиль выглядел живее."
                : "Пользователь пока не добавил фото."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {localPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-gold/10 bg-base-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Фото профиля"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => deleteProfilePhoto(photo)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-red-400/20 bg-black/60 text-red-200 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                    aria-label="Удалить фото"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
