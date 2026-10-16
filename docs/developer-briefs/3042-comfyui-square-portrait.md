# #3042 — actual local square portrait dimensions

Authenticated Windows main UAT requested one 1:1 Portrait for the existing Brotherly Love character through verified local ComfyUI. Its workflow emitted 576×768; the UI correctly refused Save. Existing static cloud-aspect tests did not exercise the actual ComfyUI submission.

Repair only the basic workflow's latent square branch. Use the established SDXL local square size 704×704, preserving portrait 576×768 and landscape 768×576, sampler settings, one-image batch, selected provider and all source/canon/approval boundaries. Do not crop output, weaken actual-dimension validation, or substitute a provider. #3041 remains paused.

Existing #3032 W8/W9 regression now executes the actual existing workflow builder in a dependency-free Node VM; no copied implementation, network request or image write. Red on main: square latent was rectangular. Square must have equal positive dimensions; portrait/landscape remain unchanged. Fixture does not prove a live image. Repeat the original local portrait request on Windows, verify actual dimensions, Save draft hash and reopen. All prior accepted artwork and the incomplete eight-view lock gate remain intact.
