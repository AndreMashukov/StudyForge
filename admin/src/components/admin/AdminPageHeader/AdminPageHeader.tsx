export interface IAdminPageHeaderProps {
  title: string;
  description: string;
}

export function AdminPageHeader({ title, description }: IAdminPageHeaderProps) {
  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
