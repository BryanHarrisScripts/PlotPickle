import type { PlotPickleServices } from "../../../lib/core-services";
import {
  PLOTPICKLE_SDK_API_VERSION,
  PLOTPICKLE_SDK_VERSION,
  type SdkConnection,
  type SdkConnectionOptions,
  type SdkHost,
} from "../../types/src/index";

export class PlotPickleSdkError extends Error {
  constructor(message: string, readonly code: "INCOMPATIBLE_API" | "INVALID_CLIENT" | "INVALID_HOST") {
    super(message);
    this.name = "PlotPickleSdkError";
  }
}

function validateOptions(options: SdkConnectionOptions) {
  if (options.apiVersion !== PLOTPICKLE_SDK_API_VERSION) {
    throw new PlotPickleSdkError(`SDK API ${options.apiVersion} is not supported. Expected ${PLOTPICKLE_SDK_API_VERSION}.`, "INCOMPATIBLE_API");
  }
  if (!options.clientName.trim() || !options.clientVersion.trim()) {
    throw new PlotPickleSdkError("clientName and clientVersion are required.", "INVALID_CLIENT");
  }
}

function validateHost(host: SdkHost) {
  if (!host || host.apiVersion !== PLOTPICKLE_SDK_API_VERSION || !host.services) {
    throw new PlotPickleSdkError("The PlotPickle SDK host is missing or incompatible.", "INVALID_HOST");
  }
}

export function connectPlotPickle(host: SdkHost, options: SdkConnectionOptions): SdkConnection {
  validateHost(host);
  validateOptions(options);
  return Object.freeze({
    apiVersion: PLOTPICKLE_SDK_API_VERSION,
    sdkVersion: PLOTPICKLE_SDK_VERSION,
    clientName: options.clientName,
    clientVersion: options.clientVersion,
    services: host.services,
  });
}

export function createSdkHost(services: PlotPickleServices): SdkHost {
  if (services.apiVersion !== PLOTPICKLE_SDK_API_VERSION) {
    throw new PlotPickleSdkError(`Core services API ${services.apiVersion} is incompatible with SDK API ${PLOTPICKLE_SDK_API_VERSION}.`, "INCOMPATIBLE_API");
  }
  return Object.freeze({ apiVersion: PLOTPICKLE_SDK_API_VERSION, services });
}
