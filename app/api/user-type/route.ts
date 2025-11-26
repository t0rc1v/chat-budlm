import { getUserType } from "@/lib/db/queries";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTypeResult = await getUserType(userId);

    if (!userTypeResult) {
      return NextResponse.json(
        { error: "User type not found" },
        { status: 404 }
      );
    }

    const userType = userTypeResult;

    return NextResponse.json(
      { role: userType },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error getting user role", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}