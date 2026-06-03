// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/ui — Button component.

import * as React from "react";
import { cn } from "../../utils/cn";
import { getVariantClass } from "../../utils/variants";
import { Spinner } from "../feedback/Spinner";
import { buttonVariants } from "./button.variants";

type ButtonVariant = keyof typeof buttonVariants.variant;
type ButtonSize = keyof typeof buttonVariants.size;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", loading, disabled, asChild, className, children, ...props },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

  const cls = cn(
    base,
    getVariantClass(
      { variant: buttonVariants.variant as any, size: buttonVariants.size as any },
      { variant, size }
    ),
    className
  );

  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : null}
      <span>{children}</span>
    </>
  );

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const childContent = (
      <>
        {loading ? <Spinner className="h-4 w-4" /> : null}
        {child.props.children}
      </>
    );
    return React.cloneElement(child, {
      className: cn(child.props.className, cls),
      children: childContent,
    });
  }

  return (
    <button
      ref={ref}
      className={cls}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
});
