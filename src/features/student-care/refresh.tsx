"use client";
import { useRouter } from "next/navigation";
import { useEffect,useTransition } from "react";
export function StudentCareRefresh() {
 const router=useRouter();const [,start]=useTransition();
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==="visible"&&!document.querySelector("form:focus-within")) start(()=>router.refresh());};
  const timer=setInterval(refresh,60_000);
  document.addEventListener("visibilitychange",refresh);
  return ()=>{clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
 },[router]);
 return null;
}
