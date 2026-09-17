import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { careFilterSchema,dashboardSchema,detailSchema,studentsSchema } from "./models";

export async function getCareDashboard(filter:unknown={}) {
  try {
    const client=await createSupabaseServerClient();
    const parsed=careFilterSchema.parse(filter);
    const {data,error}=await client.rpc("get_student_care_dashboard",{p_filter:parsed});
    if(error) return null;
    const result=dashboardSchema.safeParse(data);
    return result.success?result.data:null;
  } catch {return null;}
}
export async function getCareDetail(taskId:string) {
  try {
    const client=await createSupabaseServerClient();
    const {data,error}=await client.rpc("get_student_care_detail",{p_task_id:taskId});
    if(error) return {ok:false as const};
    if(data===null) return {ok:true as const,data:null};
    const parsed=detailSchema.safeParse(data);
    return parsed.success?{ok:true as const,data:parsed.data}:{ok:false as const};
  } catch {return {ok:false as const};}
}
export async function getCareStudents(search:string,page:number,inactive:boolean) {
  try {
    const client=await createSupabaseServerClient();
    const {data,error}=await client.rpc("get_student_care_students",{p_search:search.slice(0,160),p_page:page,p_inactive:inactive});
    if(error) return null;
    const result=studentsSchema.safeParse(data);
    return result.success?result.data:null;
  } catch {return null;}
}
