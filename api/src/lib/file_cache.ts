import { FileUpload } from "schema";

// type AssetCache = {
//   [doc_ref_id: string]: ;
// };
//inmem cache. heheheheheh
export const ASSET_CACHE = new Map<
  string,
  { uid: string; files: FileUpload[] }
>(); // map stub_id --> file contents
