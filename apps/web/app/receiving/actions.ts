"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { putawayInputSchema, receiveStockInputSchema } from "@wms/shared";

import { ApiRequestError, confirmReceipt, putAway } from "../../lib/api";
import { getSession } from "../../lib/session";

export async function confirmReceiptAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Freceiving");
  }

  const taskId = readString(formData.get("taskId"));
  const taskCode = readString(formData.get("taskCode")) ?? taskId;
  const parsed = receiveStockInputSchema.safeParse({
    taskId,
    barcode: readString(formData.get("barcode")),
    quantity: Number(readString(formData.get("quantity")))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(taskCode, "Enter a valid barcode and quantity."));
  }

  try {
    await confirmReceipt(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/receiving");
    revalidatePath("/inventory");

    redirect(`/receiving?result=receipt-confirmed&task=${encodeURIComponent(taskCode)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(taskCode, error.message));
    }

    throw error;
  }
}

export async function putAwayAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Freceiving");
  }

  const taskId = readString(formData.get("taskId"));
  const taskCode = readString(formData.get("taskCode")) ?? taskId;
  const parsed = putawayInputSchema.safeParse({
    taskId,
    destinationBin: readString(formData.get("destinationBin"))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(taskCode, "Enter a valid destination bin."));
  }

  try {
    await putAway(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/receiving");
    revalidatePath("/inventory");

    redirect(`/receiving?result=putaway-completed&task=${encodeURIComponent(taskCode)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(taskCode, error.message));
    }

    throw error;
  }
}

function buildErrorLocation(taskCode: string, message: string) {
  return `/receiving?error=action-failed&task=${encodeURIComponent(taskCode)}&message=${encodeURIComponent(message)}`;
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
