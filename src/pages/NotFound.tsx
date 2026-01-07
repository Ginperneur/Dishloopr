import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="container py-32 flex flex-col items-center justify-center text-center">
        <h1 className="text-8xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Pagina niet gevonden</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          De pagina die je zoekt bestaat niet of is verplaatst. Geen zorgen, we helpen je graag verder!
        </p>
        <div className="flex gap-4">
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Naar home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/search">
              <Search className="w-4 h-4 mr-2" />
              Zoek restaurants
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
