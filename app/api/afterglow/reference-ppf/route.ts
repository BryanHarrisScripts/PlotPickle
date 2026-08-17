import { AFTERGLOW_REFERENCE_PPF_FILENAME, createAfterglowReferencePpf } from "@/lib/afterglow-reference-ppf";

export const runtime = "nodejs";

export async function GET() {
  const { buffer } = createAfterglowReferencePpf();
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.plotpickle.ppf+zip",
      "Content-Disposition": `attachment; filename="${AFTERGLOW_REFERENCE_PPF_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  });
}
