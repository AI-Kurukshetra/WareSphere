"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { initiateReturnInputSchema, processReturnInputSchema } from "@wms/shared";

import { ApiRequestError, initiateReturn, processReturn } from "../../lib/api";
import { getSession } from "../../lib/session";

export async function createReturnAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Freturns");
  }

  const orderId = readString(formData.get("orderId"));
  const sku = readString(formData.get("sku"));
  const parsed = initiateReturnInputSchema.safeParse({
    orderId,
    sku,
    quantity: Number(readString(formData.get("quantity"))),
    sourceReference: readNullableString(formData.get("sourceReference"))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(orderId || sku, "Enter a valid SKU, quantity, and return reference."));
  }

  try {
    const result = await initiateReturn(session, parsed.data);
    revalidatePath("/returns");

    redirect(`/returns?result=return-created&returns=${encodeURIComponent(result.returnRequest.id)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(orderId || sku, error.message));
    }

    throw error;
  }
}

export async function processReturnAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Freturns");
  }

  const returnId = readString(formData.get("returnId"));
  const parsed = processReturnInputSchema.safeParse({
    returnId,
    barcode: readString(formData.get("barcode")),
    disposition: readString(formData.get("disposition")),
    destinationBin: readString(formData.get("destinationBin"))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(returnId, "Enter the barcode, disposition, and destination bin."));
  }

  try {
    const result = await processReturn(session, parsed.data);
    revalidatePath("/inventory");
    revalidatePath("/returns");

    redirect(
      `/returns?result=return-processed&returns=${encodeURIComponent(result.returnRequest.id)}&disposition=${encodeURIComponent(result.returnRequest.disposition ?? "")}`
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(returnId, error.message));
    }

    throw error;
  }
}

function buildErrorLocation(reference: string, message: string) {
  return `/returns?error=action-failed&ref=${encodeURIComponent(reference)}&message=${encodeURIComponent(message)}`;
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(value: FormDataEntryValue | null) {
  const parsed = readString(value);
  return parsed.length > 0 ? parsed : null;
}
