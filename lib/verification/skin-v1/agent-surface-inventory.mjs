/**
 * #3355 / #3263: skin-neutral surface discovery for agent and Human clients.
 * Registered surface metadata is not an execution grant or render proof.
 */
import { SKIN_V1_SURFACE_REGISTRY } from "../skin-v1-surface-registry.mjs";

const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ROUTE=/^\/[a-zA-Z0-9_/?=&.%-]*$/u;
const CLASSES=new Set(["reference","directory","workspace","nested","public-exception"]);
const frozen=value=>Object.freeze(value);

function project(surface){
  const configuredRoute=typeof surface.route==="string" && ROUTE.test(surface.route)
    ? surface.route : null;
  const registryState=surface.capturePolicy==="standard" && surface.orchestrated===true
    ? "REGISTERED_FOR_UI" : surface.capturePolicy==="public-exception"
      ? "PUBLIC_EXCEPTION" : "CENSUS_ONLY";
  return frozen({
    id:surface.id,label:surface.label,family:surface.family,
    parentId:surface.parent??null,surfaceClass:surface.surfaceClass,
    navigation:frozen((surface.navigationPath||[]).map(segment=>frozen({
      order:segment.order,slug:segment.slug,label:segment.label,
    }))),
    presentation:frozen({
      registryState,route:configuredRoute,
      layoutProfile:surface.formatProfile?.layout??null,runtimeVerified:false,
    }),
    headless:frozen({
      discovery:"AVAILABLE",read:"NOT_ATTESTED",actions:"NOT_ATTESTED",
      operations:frozen([]),
    }),
  });
}

/** All registered surfaces are discoverable, but nothing private is projected. */
export function describePlotPickleSurfaces({
  surfaceId=null,registry=SKIN_V1_SURFACE_REGISTRY,
}={}){
  const envelope=(code,surfaces=[],totalRegistered=0)=>frozen({
    schemaVersion:1,code,sourceRegistry:registry?.contractId??null,
    count:surfaces.length,totalRegistered,
    canReadPrivateProject:false,canMutate:false,
    surfaces:frozen(surfaces),
  });
  if(surfaceId!==null &&
    (typeof surfaceId!=="string" || surfaceId.length>96 || !ID.test(surfaceId)))
    return envelope("INVALID_SURFACE_ID");
  if(registry?.schemaVersion!==1 ||
    registry?.contractId!=="skin-v1-surface-registry-v1" ||
    !Array.isArray(registry.surfaces))return envelope("REGISTRY_UNVERIFIED");
  const ids=new Set();
  for(const surface of registry.surfaces){
    if(!surface || !ID.test(surface.id||"") || ids.has(surface.id) ||
      !CLASSES.has(surface.surfaceClass) || typeof surface.label!=="string" ||
      typeof surface.family!=="string" ||
      (surface.parent!=null && !ID.test(surface.parent)))
      return envelope("REGISTRY_UNVERIFIED");
    ids.add(surface.id);
  }
  const selected=surfaceId===null ? registry.surfaces :
    registry.surfaces.filter(surface=>surface.id===surfaceId);
  if(surfaceId!==null && selected.length===0)
    return envelope("UNKNOWN_SURFACE",[],registry.surfaces.length);
  return envelope("SURFACE_CATALOG_READ_ONLY",selected.map(project),registry.surfaces.length);
}
