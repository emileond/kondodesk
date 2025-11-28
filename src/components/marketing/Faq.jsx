import { Accordion, AccordionItem } from '@heroui/react';

export default function Faq() {
    const accordionItems = [
        {
            title: '¿Cómo evita Kondodesk los choques de horario en las amenidades?',
            content: (
                <div className="text-muted-foreground py-1 space-y-6">
                    <p>
                        Configuramos calendarios por amenidad y bloqueos inteligentes de horario para que no se crucen reservas. También puedes definir aforos, tiempos mínimos/máximos y días no disponibles.
                    </p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Calendario por amenidad</strong>
                            <p>
                                Cada gimnasio, terraza o cancha tiene su propio calendario con disponibilidad clara por día y hora.
                            </p>
                        </li>
                        <li>
                            <strong>Reglas y aforos</strong>
                            <p>
                                Establece duración máxima, anticipación mínima, número de invitados y aforos por amenidad.
                            </p>
                        </li>
                        <li>
                            <strong>Aprobaciones opcionales</strong>
                            <p>
                                Activa aprobaciones por parte de administración para eventos especiales o áreas comunes que lo requieran.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: '¿Para quién es Kondodesk?',
            content: (
                <div className="text-muted-foreground py-1 space-y-6">
                    <p className="mb-6">
                        Kondodesk está pensado para administraciones de condominios, comités y
                        desarrollos que necesitan organizar reservas de amenidades y comunicar
                        avisos a toda la comunidad de forma simple.
                    </p>

                    <p>Es ideal si buscas:</p>

                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Evitar choques de horario</strong>
                            <p>
                                Calendarios por amenidad con reglas claras, aforos y aprobación
                                opcional para eventos.
                            </p>
                        </li>
                        <li>
                            <strong>Comunicación centralizada</strong>
                            <p>
                                Publica comunicados, reglamentos y recordatorios para todos los
                                residentes desde un solo lugar.
                            </p>
                        </li>
                        <li>
                            <strong>Control por roles</strong>
                            <p>
                                Define quién puede reservar, aprobar o publicar avisos (admin,
                                conserje, residente).
                            </p>
                        </li>
                        <li>
                            <strong>Historial y reportes</strong>
                            <p>
                                Consulta actividad y genera reportes para una administración más
                                ordenada.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: '¿Qué integraciones soporta Kondodesk?',
            content: (
                <div className="text-muted-foreground">
                    Actualmente trabajamos en integraciones con herramientas usadas por condominios.
                    Si tienes alguna prioridad (por ejemplo, pasarelas de pago o comunicación), compártenosla y la consideramos en el roadmap.
                </div>
            ),
        },
        {
            title: '¿Puedo cambiar o cancelar una reserva?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p>
                        Sí. Dependiendo de las reglas que definas para cada amenidad, los residentes pueden modificar o cancelar sus reservas con una anticipación mínima.
                    </p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Ventana de cancelación</strong>
                            <p>
                                Establece con cuántas horas o días de anticipación se puede cancelar sin penalización.
                            </p>
                        </li>
                        <li>
                            <strong>Reprogramación</strong>
                            <p>
                                Permite mover la reserva a otro horario disponible sin generar choques.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: '¿Cómo funcionan los avisos y notificaciones?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p>
                        Puedes publicar avisos generales, reglamentos y comunicados para toda la comunidad o por torre. Los residentes reciben notificaciones y pueden consultarlos cuando lo necesiten.
                    </p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Tipos de avisos</strong>
                            <p>
                                Novedades, mantenimiento, eventos, reglamentos y recordatorios de reservas.
                            </p>
                        </li>
                        <li>
                            <strong>Notificaciones</strong>
                            <p>
                                Envío de notificaciones por correo y dentro de la app. Próximamente: canales adicionales según tu preferencia.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: '¿Cómo protege Kondodesk mis datos?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p className="mb-6">
                        Tomamos muy en serio la privacidad y seguridad. Tus datos se transmiten de forma cifrada y sólo personal autorizado puede acceder a información necesaria para brindar soporte.
                    </p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Cifrado y acceso</strong>
                            <p>
                                Cifrado en tránsito y controles de acceso por rol para proteger la información sensible.
                            </p>
                        </li>
                        <li>
                            <strong>Propiedad de datos</strong>
                            <p>
                                Tus datos pertenecen a tu condominio. No vendemos información y sólo se usa para operar el servicio.
                            </p>
                        </li>
                        <li>
                            <strong>Respaldo y continuidad</strong>
                            <p>
                                Contamos con respaldos y monitoreo para mantener la disponibilidad del sistema.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
        {
            title: '¿Ofrecen prueba gratis y soporte?',
            content: (
                <div className="text-muted-foreground space-y-6">
                    <p className="mb-6">
                        Sí. Ofrecemos una <strong>prueba gratis de 14 días</strong> sin necesidad de tarjeta.
                        Puedes cancelar en cualquier momento durante el periodo de prueba.
                    </p>
                    <ul className="list-inside space-y-6">
                        <li>
                            <strong>Soporte en español</strong>
                            <p>
                                Atención por correo en horario hábil (MX). Tiempo de respuesta típico: 24–48 h.
                            </p>
                        </li>
                        <li>
                            <strong>Canal prioritario</strong>
                            <p>
                                Para administradores con plan activo brindamos canal de soporte prioritario para incidencias.
                            </p>
                        </li>
                        <li>
                            <strong>Sin letra chiquita</strong>
                            <p>
                                No pedimos tarjeta para la prueba y puedes decidir luego si continúas con un plan de pago.
                            </p>
                        </li>
                    </ul>
                </div>
            ),
        },
    ];

    return (
        <div id="faq" className="mx-auto max-w-3xl py-32">
            <div className="flex flex-col gap-3 justify-center items-center">
                <h4 className="text-2xl font-bold sm:text-3xl mb-9">Preguntas frecuentes</h4>
            </div>
            <div className="w-full">
                <Accordion fullWidth selectionMode="multiple" variant="shadow">
                    {accordionItems?.map((item, index) => (
                        <AccordionItem
                            key={index}
                            aria-label={item.title}
                            title={item.title}
                            className="font-medium "
                        >
                            <p className="font-normal text-default-700 text-md text-pretty pt-3 pb-6">
                                {item.content}
                            </p>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}
