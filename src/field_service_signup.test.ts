import { signupBody } from "./field_service_signup.ts";

const accepted = signupBody.safeParse({ email: "shop@example.com", password: "checkout-pass", name: "Rina", workOrderId: "WO-1042", photos: ["arrival.jpg"], dispatchStatus: "assigned", technicianFollowUp: "Call after parts delivery" });
if (!accepted.success || accepted.data.dispatchStatus !== "assigned") throw new Error("assigned work order should be accepted");
const rejected = signupBody.safeParse({ email: "bad", password: "short", name: "", workOrderId: "", dispatchStatus: "unknown", technicianFollowUp: "" });
if (rejected.success) throw new Error("invalid signup must be rejected");
console.log("signup boundary test passed");
