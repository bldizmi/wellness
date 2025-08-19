import { db } from "@/lib/db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export async function createUserRecord(firebaseUser: {
  uid: string;
  email: string | null;
}) {
  if (!firebaseUser.email) throw new Error("Email is required");

  const defaultUsername = firebaseUser.email.split("@")[0];

  const [user] = await db
    .insert(users)
    .values({
      firebase_uid: firebaseUser.uid,
      email: firebaseUser.email,
      username: defaultUsername,
      role: "member",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning();

  return user;
}

export async function updateUserLogin(firebaseUid: string) {
  try {
    const updatedUsers = await db
      .update(users)
      .set({
        last_login: new Date(),
        updated_at: new Date(),
      })
      .where(eq(users.firebase_uid, firebaseUid))
      .returning();

    if (!updatedUsers.length) {
      throw new Error(`User with UID ${firebaseUid} not found`);
    }

    return updatedUsers[0];
  } catch (error) {
    console.error("Error updating user login:", error);
    throw error;
  }
}
