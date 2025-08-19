
import { Menu } from "lucide-react"
import { Link, useLocation } from "wouter"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export default function MobileNav() {
  const [location] = useLocation()
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/today">
            <Button 
              variant={location === "/today" ? "default" : "ghost"}
              className="w-full justify-start"
            >
              Today's Tasks
            </Button>
          </Link>
          <Link href="/plans">
            <Button 
              variant={location === "/plans" ? "default" : "ghost"}
              className="w-full justify-start"
            >
              Plans
            </Button>
          </Link>
          <Link href="/profile">
            <Button 
              variant={location === "/profile" ? "default" : "ghost"}
              className="w-full justify-start"
            >
              Profile
            </Button>
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
