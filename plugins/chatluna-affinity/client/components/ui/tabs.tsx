import { Tabs as HeroTabs } from "@heroui/react/tabs";
import * as React from "react";
import { cn } from "../../lib/utils";

type TabsProps = Omit<
  React.ComponentProps<typeof HeroTabs>,
  "defaultSelectedKey" | "onSelectionChange" | "selectedKey"
> & {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

function Tabs({
  className,
  defaultValue,
  onValueChange,
  value,
  ...props
}: TabsProps) {
  return (
    <HeroTabs
      className={cn("flex flex-col gap-4", className)}
      defaultSelectedKey={defaultValue}
      selectedKey={value}
      onSelectionChange={(key) => onValueChange?.(String(key))}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof HeroTabs.List>) {
  return (
    <HeroTabs.ListContainer className="w-fit">
      <HeroTabs.List
        className={cn("w-fit shadow-none", className)}
        {...props}
      />
    </HeroTabs.ListContainer>
  );
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: Omit<React.ComponentProps<typeof HeroTabs.Tab>, "id"> & {
  value: string;
}) {
  return (
    <HeroTabs.Tab
      className={cn("min-w-fit whitespace-nowrap px-4 text-sm", className)}
      id={value}
      {...props}
    >
      {children}
      <HeroTabs.Indicator />
    </HeroTabs.Tab>
  );
}

function TabsContent({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<typeof HeroTabs.Panel>, "id"> & {
  value: string;
}) {
  return (
    <HeroTabs.Panel
      className={cn("mt-0 p-0 outline-none", className)}
      id={value}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
