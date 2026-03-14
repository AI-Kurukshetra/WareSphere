"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  allocateOrderInputSchema,
  dispatchShipmentInputSchema,
  packOrderInputSchema,
  pickStockInputSchema
} from "@wms/shared";

import {
  allocateOrder,
  ApiRequestError,
  confirmPack,
  confirmPick,
  dispatchShipment
} from "../../lib/api";
import { getSession } from "../../lib/session";

export async function allocateOrderAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Forders");
  }

  const orderId = readString(formData.get("orderId"));
  const parsed = allocateOrderInputSchema.safeParse({
    orderId
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(orderId, "Enter a valid order reference."));
  }

  try {
    await allocateOrder(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/inventory");
    revalidatePath("/orders");

    redirect(`/orders?result=allocated&order=${encodeURIComponent(orderId)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(orderId, error.message));
    }

    throw error;
  }
}

export async function confirmPickAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Forders");
  }

  const taskId = readString(formData.get("taskId"));
  const parsed = pickStockInputSchema.safeParse({
    taskId,
    sourceBin: readString(formData.get("sourceBin")),
    barcode: readString(formData.get("barcode")),
    quantity: Number(readString(formData.get("quantity")))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(taskId, "Enter a valid bin, barcode, and quantity."));
  }

  try {
    await confirmPick(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/inventory");
    revalidatePath("/orders");

    redirect(`/orders?result=pick-confirmed&task=${encodeURIComponent(taskId)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(taskId, error.message));
    }

    throw error;
  }
}

export async function confirmPackAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Forders");
  }

  const taskId = readString(formData.get("taskId"));
  const parsed = packOrderInputSchema.safeParse({
    taskId,
    packageCount: Number(readString(formData.get("packageCount")))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(taskId, "Enter a valid package count before confirming packing."));
  }

  try {
    await confirmPack(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/orders");

    redirect(`/orders?result=pack-confirmed&task=${encodeURIComponent(taskId)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(taskId, error.message));
    }

    throw error;
  }
}

export async function dispatchShipmentAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?next=%2Forders");
  }

  const shipmentId = readString(formData.get("shipmentId"));
  const parsed = dispatchShipmentInputSchema.safeParse({
    shipmentId,
    carrierCode: readString(formData.get("carrierCode")),
    serviceLevel: readString(formData.get("serviceLevel")),
    trackingNumber: readString(formData.get("trackingNumber"))
  });

  if (!parsed.success) {
    redirect(buildErrorLocation(shipmentId, "Enter the carrier, service level, and tracking number."));
  }

  try {
    const result = await dispatchShipment(session, parsed.data);
    revalidatePath("/");
    revalidatePath("/orders");

    redirect(`/orders?result=shipment-dispatched&order=${encodeURIComponent(result.order.id)}`);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      redirect(buildErrorLocation(shipmentId, error.message));
    }

    throw error;
  }
}

function buildErrorLocation(reference: string, message: string) {
  return `/orders?error=action-failed&ref=${encodeURIComponent(reference)}&message=${encodeURIComponent(message)}`;
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
