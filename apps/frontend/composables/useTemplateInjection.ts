import Handlebars from 'handlebars'

export async function renderTemplate(name: string, data: any) {
  const res = await fetch(`/api/templates/${name}`)
  const template = await res.text()
  const compiled = Handlebars.compile(template)
  return compiled(data)
}
