export const mdxComponents = {
    h1: (props) => <h1 className="text-4xl font-bold mb-6 leading-tight text-pretty" {...props} />,
    h2: (props) => <h2 className="text-3xl font-bold mb-6 mt-14 leading-snug" {...props} />,
    h3: (props) => <h3 className="text-2xl font-semibold mb-4 leading-snug" {...props} />,
    h4: (props) => <h4 className="text-xl font-medium mb-3 leading-snug" {...props} />,
    h5: (props) => <h5 className="text-lg font-medium mb-2 leading-snug" {...props} />,
    h6: (props) => <h6 className="text-base font-medium mb-2 leading-snug" {...props} />,
    p: (props) => <p className="mb-6 text-foreground leading-relaxed " {...props} />,
    a: (props) => (
        <a
            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
            {...props}
        />
    ),
    img: (props) => (
        <img
            className="rounded-md shadow-md my-6 max-w-full"
            alt={props.alt || 'Blog image'}
            {...props}
        />
    ),
    blockquote: (props) => (
        <blockquote
            className="border-l-4 border-gray-300 pl-4 italic text-gray-700 mb-6"
            {...props}
        />
    ),
    ul: (props) => <ul className="list-disc list-inside mb-6" {...props} />,
    ol: (props) => <ol className="list-decimal list-inside mb-6" {...props} />,
    li: (props) => <li className="mb-2" {...props} />,
    code: (props) => <code className="bg-gray-100 rounded px-1 text-sm font-mono" {...props} />,
    pre: (props) => (
        <pre className="bg-gray-800 text-white p-4 rounded-md overflow-auto mb-6" {...props} />
    ),
};
