"use client";

import { createClient } from "@/lib/supabase/client";
import type { EncryptedKeyBackup } from "@/lib/crypto";

export type CloudBackupRow = {
  user_id: string;
  v: number;
  alg: string;
  salt: string;
  iv: string;
  ciphertext: string;
  public_key: JsonWebKey;
  created_at: string;
  updated_at: string;
};

/** True if a cloud backup row exists for this user (ciphertext only). */
export async function hasCloudKeyBackup(userId: string): Promise<boolean> {
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from("e2ee_key_backups")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Table missing until SQL patch — treat as no cloud backup
    console.warn("e2ee cloud backup check:", error.message);
    return false;
  }
  return !!data;
}

export async function fetchCloudKeyBackup(
  userId: string
): Promise<EncryptedKeyBackup | null> {
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from("e2ee_key_backups")
    .select("v, alg, salt, iv, ciphertext, public_key, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    v: data.v ?? 1,
    alg: (data.alg as EncryptedKeyBackup["alg"]) ?? "PBKDF2-AES-GCM",
    salt: data.salt,
    iv: data.iv,
    ciphertext: data.ciphertext,
    publicKeyJwk: data.public_key as JsonWebKey,
    createdAt: data.created_at,
  };
}

/** Upload passphrase-encrypted backup. Never sends the passphrase. */
export async function uploadCloudKeyBackup(
  userId: string,
  backup: EncryptedKeyBackup
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient() as any;
  const { error } = await supabase.from("e2ee_key_backups").upsert(
    {
      user_id: userId,
      v: backup.v,
      alg: backup.alg,
      salt: backup.salt,
      iv: backup.iv,
      ciphertext: backup.ciphertext,
      public_key: backup.publicKeyJwk,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("e2ee_key_backups") ||
        error.message.includes("relation")
          ? "В Supabase не применена таблица e2ee_key_backups (patch_e2ee_cloud_backup.sql)."
          : error.message,
    };
  }
  return { ok: true };
}

export async function publishPublicKey(
  userId: string,
  publicKeyJwk: JsonWebKey
): Promise<void> {
  const supabase = createClient() as any;
  await supabase.from("encryption_keys").upsert({
    user_id: userId,
    public_key: publicKeyJwk,
    updated_at: new Date().toISOString(),
  });
}
