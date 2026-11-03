import { authorizeLocalFactoryRequest } from "../../../../core/auth/profile-experience/local-factory-request";
import { describePlotPickleSurfaces } from "../../../../lib/verification/skin-v1/agent-surface-inventory.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Read-only discovery through the existing local Human profile authority. */
export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.pathname!=="/api/experience/surfaces" ||
    Array.from(url.searchParams.keys()).some(key=>key!=="surfaceId") ||
    url.searchParams.getAll("surfaceId").length>1)
    return Response.json({code:"INVALID_SURFACE_SELECTION"},{status:400});
  try {
    await authorizeLocalFactoryRequest(request,false);
  }catch{
    return Response.json({code:"PROFILE_SESSION_REQUIRED"},{status:403});
  }
  const result=describePlotPickleSurfaces({surfaceId:url.searchParams.get("surfaceId")});
  const status=result.code==="SURFACE_CATALOG_READ_ONLY"?200:
    result.code==="UNKNOWN_SURFACE"?404:400;
  return Response.json(result,{status,headers:{
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}
