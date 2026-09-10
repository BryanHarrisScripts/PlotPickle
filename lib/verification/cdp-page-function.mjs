function cdpFailure(result, fallback) {
  if (!result?.exceptionDetails) return null;
  return new Error(
    result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || fallback,
  );
}

function structuredArgument(value) {
  if (value === undefined) return Object.freeze({ unserializableValue: "undefined" });
  if (typeof value === "number" && !Number.isFinite(value)) {
    return Object.freeze({ unserializableValue: String(value) });
  }
  return Object.freeze({ value });
}

/**
 * Invoke a fixed browser function through CDP while carrying caller values as
 * structured Runtime.callFunctionOn arguments. Values never become executable
 * JavaScript source.
 */
export async function callCdpPageFunction(client, functionDeclaration, values = []) {
  if (!client || typeof client.send !== "function") throw new Error("CDP page calls require a connected client.");
  if (typeof functionDeclaration !== "string" || !functionDeclaration.trim()) throw new Error("CDP page calls require a fixed function declaration.");

  const globalObject = await client.send("Runtime.evaluate", {
    expression: "globalThis",
    returnByValue: false,
  });
  const globalFailure = cdpFailure(globalObject, "Browser global-object lookup failed.");
  if (globalFailure) throw globalFailure;
  const objectId = globalObject.result?.objectId;
  if (!objectId) throw new Error("Browser global-object lookup did not return an object identifier.");

  try {
    const result = await client.send("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration,
      arguments: values.map(structuredArgument),
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    const failure = cdpFailure(result, "Browser function call failed.");
    if (failure) throw failure;
    return result.result?.value;
  } finally {
    try {
      await client.send("Runtime.releaseObject", { objectId });
    } catch {}
  }
}
