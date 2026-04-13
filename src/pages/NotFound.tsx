import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { Container } from "../components/ui/Container";
import { Card, CardBody } from "../components/ui/Card";

export function NotFoundPage() {
  return (
    <>
      <Seo
        title="Page not found"
        description="The page you’re looking for was not found on ABLEBIZ Business Services."
      />
      <Container className="py-20">
        <Card>
          <CardBody>
            <div className="text-2xl font-extrabold text-[color:var(--ablebiz-primary)]">
              404 – Page not found
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Use the navigation or go back to the homepage.
            </p>
            <div className="mt-4">
              <Link
                to="/"
                className="text-sm font-semibold text-[color:var(--ablebiz-accent)] underline"
              >
                Go to Home
              </Link>
            </div>
          </CardBody>
        </Card>
      </Container>
    </>
  );
}
