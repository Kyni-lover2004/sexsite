import type { Metadata } from "next";

/** Private club: app pages should not be indexed by search engines. */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

/** Landing / marketing may be indexed. */
export const publicMetadata: Metadata = {
  robots: { index: true, follow: true },
};
