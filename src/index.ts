// Step 3 で実装: Worker エントリポイント
export default {
  async fetch(): Promise<Response> {
    return new Response("chief-of-staff is running");
  },
};
