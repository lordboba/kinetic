import type { FastifyReply, FastifyRequest } from "fastify";
import {
  get_user_profile,
  create_user_profile,
  update_user_preferences,
} from "../lib/firebase_admin.js";
import { LecturePreferencesSchema } from "../schemas/create-lecture.js";
import { z } from "zod";

const UpdatePreferencesSchema = z.object({
  preferences: LecturePreferencesSchema,
});

const CreateProfileSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  preferences: LecturePreferencesSchema.optional(),
});

// GET /api/users/profile - Get user profile
export async function get_profile_handler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  try {
    if (!req.user?.uid) {
      return reply.code(401).send({
        success: false,
        error: "Unauthorized: No user ID found",
      });
    }

    const profile = await get_user_profile(req.user.uid);

    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: "Profile not found",
      });
    }

    return reply.code(200).send({
      success: true,
      profile,
    });
  } catch (error) {
    req.log.error(error, "Error fetching user profile");
    return reply.code(500).send({
      success: false,
      error: "Failed to fetch user profile",
    });
  }
}

// PUT /api/users/profile/preferences - Update user preferences
export async function update_preferences_handler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  try {
    if (!req.user?.uid) {
      return reply.code(401).send({
        success: false,
        error: "Unauthorized: No user ID found",
      });
    }

    const body = UpdatePreferencesSchema.parse(req.body);

    await update_user_preferences(req.user.uid, body.preferences);

    return reply.code(200).send({
      success: true,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: "Invalid request body",
        details: error.errors,
      });
    }

    req.log.error(error, "Error updating user preferences");
    return reply.code(500).send({
      success: false,
      error: "Failed to update preferences",
    });
  }
}

// POST /api/users/profile - Create user profile
export async function create_profile_handler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  try {
    if (!req.user?.uid) {
      return reply.code(401).send({
        success: false,
        error: "Unauthorized: No user ID found",
      });
    }

    // Check if profile already exists
    const existingProfile = await get_user_profile(req.user.uid);
    if (existingProfile) {
      return reply.code(409).send({
        success: false,
        error: "Profile already exists",
      });
    }

    const body = CreateProfileSchema.parse(req.body);

    const profile = await create_user_profile(
      req.user.uid,
      body.email,
      body.displayName,
      body.preferences
    );

    return reply.code(201).send({
      success: true,
      profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: "Invalid request body",
        details: error.errors,
      });
    }

    req.log.error(error, "Error creating user profile");
    return reply.code(500).send({
      success: false,
      error: "Failed to create profile",
    });
  }
}
