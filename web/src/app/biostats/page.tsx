import { redirect } from "next/navigation";

/**
 * Moved into its hub. Kept as a permanent redirect so old links keep working:
 * biostats lives in /research?tab=biostat.
 */
export default function LegacyBiostats() {
  redirect("/research?tab=biostat");
}