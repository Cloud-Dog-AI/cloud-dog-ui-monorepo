declare module "swagger-ui-react" {
  import * as React from "react";

  export type SwaggerUIProps = Readonly<{
    url?: string;
    spec?: unknown;
    className?: string;
  }>;

  export default class SwaggerUI extends React.Component<SwaggerUIProps> {}
}
