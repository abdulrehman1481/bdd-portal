import { redirect } from "next/navigation";

export default function LegacyHospitalRoute() {
  redirect("/dashboard/hospital");
}
