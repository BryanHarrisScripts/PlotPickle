import configuration from "../../config/buzz-agent-recommended.json";
import { validatePlotPickleRecommendedBuzzConfig } from "./plotpickle-agent-configuration-core.mjs";

export const PLOTPICKLE_RECOMMENDED_BUZZ_CONFIGURATION = validatePlotPickleRecommendedBuzzConfig(configuration);
