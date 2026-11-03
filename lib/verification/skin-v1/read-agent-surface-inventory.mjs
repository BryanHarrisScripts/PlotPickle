#!/usr/bin/env node
/** Canonical surface inventory, safe for local headless readback without browser UI. */
import { describePlotPickleSurfaces } from "./agent-surface-inventory.mjs";

const args=process.argv.slice(2);
if(args.length>1 || (args[0] && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(args[0]))){
  process.stderr.write("Expected one optional canonical surface ID.\n");
  process.exitCode=2;
}else{
  const result=describePlotPickleSurfaces({surfaceId:args[0]??null});
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
  if(result.code!=="SURFACE_CATALOG_READ_ONLY")process.exitCode=1;
}
