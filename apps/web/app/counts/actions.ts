"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adjustInventoryInputSchema,
  confirmCountInputSchema,
  releaseCountTaskInputSchema
} from "@wms/shared";

import {
  adjustInventory,
  ApiRequestError,
  confirmCount,
  releaseCountTask
} from "../../lib/api";
import { getSession } from "../../lib/session";

export async function releaseCountTaskAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Fcounts");
  }

  const inventoryId = readString(formData.get("inventoryId"));
  const reference = readString(formData.get("inventoryRef"));
  const parsed = releaseCountTaskInputSchema.safeParse({
    inventoryId
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(reference, "Select a valid inventory record before releasing a count."));
  }

  try {
    const result = await releaseCountTask(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/counts");

    redirect(`/counts?result=count-released&task=${encodeURIComponent(result.task.id)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(reference, error.message));
    }

    throw error;
  }
}

export async function confirmCountAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Fcounts");
  }

  const taskId = readString(formData.get("taskId"));
  const parsed = confirmCountInputSchema.safeParse({
    taskId,
    binCode: readString(formData.get("binCode")),
    barcode: readString(formData.get("barcode")),
    countedQuantity: Number(readString(formData.get("countedQuantity")))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(taskId, "Enter the bin, barcode, and counted quantity."));
  }

  try {
    await confirmCount(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/inventory");
    revalidatePath("/counts");

    redirect(`/counts?result=count-confirmed&task=${encodeURIComponent(taskId)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(taskId, error.message));
    }

    throw error;
  }
}

export async function adjustInventoryAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Fcounts");
  }

  const inventoryId = readString(formData.get("inventoryId"));
  const reference = readString(formData.get("inventoryRef"));
  const parsed = adjustInventoryInputSchema.safeParse({
    inventoryId,
    quantityDelta: Number(readString(formData.get("quantityDelta"))),
    reasonCode: readString(formData.get("reasonCode"))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(reference, "Enter a non-zero quantity delta and a short reason."));
  }

  try {
    await adjustInventory(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/inventory");
    revalidatePath("/counts");

    redirect(`/counts?result=inventory-adjusted&ref=${encodeURIComponent(reference)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(reference, error.message));
    }

    throw error;
  }
}

function buildErrorLocation(reference: string, message: string) {
  return `/counts?error=action-failed&ref=${encodeURIComponent(reference)}&message=${encodeURIComponent(message)}`;
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
