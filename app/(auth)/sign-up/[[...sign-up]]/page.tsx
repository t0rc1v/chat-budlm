import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="absolute w-full h-full">
       <div
         className="relative w-full h-full flex items-center justify-center"
       >
        <SignUp />
       </div>
    </div>
  )
}