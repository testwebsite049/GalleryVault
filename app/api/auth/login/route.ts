import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { dbConnect } from "@/lib/db/connect";
import { Admin } from "@/lib/db/models/Admin";
import { signJWT } from "@/lib/auth/jwt";

// Sync admin account with env configuration dynamically
async function syncAdminAccount() {
  const defaultEmail = (process.env.ADMIN_EMAIL || "admin@galleryvault.in").toLowerCase().trim();
  const plainTextPassword = process.env.ADMIN_PASSWORD || "admin123";

  const admin = await Admin.findOne({ email: defaultEmail });
  
  if (!admin) {
    // Clear any old administrative records to maintain a single account
    await Admin.deleteMany({});
    
    const passwordHash = await bcrypt.hash(plainTextPassword, 12);
    await Admin.create({
      email: defaultEmail,
      passwordHash,
    });
    console.log(`Default admin synced (created): ${defaultEmail}`);
  } else {
    // If credentials changed in env, update the database document
    const isMatch = await bcrypt.compare(plainTextPassword, admin.passwordHash);
    if (!isMatch) {
      admin.passwordHash = await bcrypt.hash(plainTextPassword, 12);
      await admin.save();
      console.log(`Default admin synced (password updated): ${defaultEmail}`);
    }
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    
    // Sync admin credentials with database
    await syncAdminAccount();

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Email and password are required.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    // Find admin in DB
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    
    if (!admin) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_INVALID",
            message: "Invalid email or password.",
            statusCode: 401,
          },
        },
        { status: 401 }
      );
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_INVALID",
            message: "Invalid email or password.",
            statusCode: 401,
          },
        },
        { status: 401 }
      );
    }

    // Sign JWT token
    const token = await signJWT(
      { role: "admin", email: admin.email },
      process.env.JWT_SECRET || "default_super_secret_jwt_key_that_is_at_least_32_characters_long",
      8 * 3600 // 8 hours
    );

    const response = NextResponse.json({ success: true });
    
    // Set admin_session cookie
    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 3600, // 8 hours
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("POST Admin Login Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "An unexpected error occurred during login.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed.",
        statusCode: 405,
      },
    },
    { status: 405 }
  );
}
