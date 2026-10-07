import { redirect } from "next/navigation";

/** Legacy sign-in URL; library access no longer requires a password. */
export default function LoginPage() {
  redirect("/");
}
